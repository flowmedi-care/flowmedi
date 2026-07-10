import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import {
  AUDIO_FALLBACK_MESSAGE,
  resolveInboundTexts,
  scheduleTranscriptionRetry,
} from "./audio-transcription";
import { runLangGraphAssistant } from "./langgraph/run";
import {
  releaseProcessingLock,
  shouldSkipDuplicateReply,
  tryAcquireProcessingLock,
} from "./langgraph/nodes/booking-continuity";
import { logAiEvent } from "./event-log";
import { sendAssistantReply } from "./send-reply";
import type { AiConversationState, VirtualAssistantSettings } from "./types";
import { isInsideAutoMessageWindow } from "@/lib/whatsapp-ops-controls";
import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import {
  detectInboundIntent,
  hasClearIntent,
  intentToAiStatePatch,
} from "./detect-inbound-intent";
import {
  applyBookingContinuityStatePatch,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "./booking-continuity";
import { tryReactivateAiAfterHandoff } from "./handoff-reactivation";
import { ensureAiPrivacyNoticeSent } from "./ai-privacy-notice";
import { buildClinicContext } from "./clinic-context";
import { runNorthStarAssistant } from "@/lib/conversational/run-north-star";
import { isLegacyRuntimeDisabled } from "@/lib/conversational/migration/legacy-runtime";
import { northStarFlagsFromSettings, shouldRunNorthStar } from "@/lib/conversational/feature-flags";

export interface SkipMenuChatbotResult {
  skipMenu: boolean;
  reason?: string;
}

async function shouldSkipAssistantHeader(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "assistant")
    .gte("sent_at", since)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

function formatOutsideHoursReply(settings: Partial<VirtualAssistantSettings>): string {
  const start = settings.bot_active_start ?? settings.operating_hours?.mon?.open ?? "08:00";
  return `Estamos fora do horário automático agora (retornamos às ${start}). Pode deixar sua dúvida que respondemos assim que abrir — ou digite o que precisa que eu já adianto.`;
}

function parseTimeToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isInsideBotWindow(settings: Partial<VirtualAssistantSettings>): boolean {
  if (!settings.bot_active_start && !settings.bot_active_end) return true;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(settings.bot_active_start, 0);
  const end = parseTimeToMinutes(settings.bot_active_end, 24 * 60 - 1);
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

export async function isVirtualAssistantActive(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ active: boolean; settings: Partial<VirtualAssistantSettings> | null; reason?: string }> {
  const { data, error } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) {
    console.error("[VirtualAssistant] erro ao ler settings:", error.message, { clinicId });
    return {
      active: false,
      settings: null,
      reason: error.message.includes("does not exist")
        ? "Tabela clinic_virtual_assistant_settings não existe — rode a migration"
        : error.message,
    };
  }

  if (!data?.enabled) {
    return {
      active: false,
      settings: data as Partial<VirtualAssistantSettings> | null,
      reason: data ? "enabled=false" : "sem registro de configuração",
    };
  }
  return {
    active: true,
    settings: data as Partial<VirtualAssistantSettings>,
  };
}

export async function processConversationAi(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  try {
    await processConversationAiInner(supabase, conversationId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[VirtualAssistant] processamento falhou:", e);
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("clinic_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conv?.clinic_id) {
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "error",
        level: "error",
        detail: { message, source: "processConversationAi" },
      });
    }
    throw e;
  }
}

async function processConversationAiInner(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, clinic_id, phone_number, ai_enabled, ai_handoff_at, ai_user_opt_out, ai_debounce_until, ai_state, patient_id, ai_privacy_notice_sent_at"
    )
    .eq("id", conversationId)
    .single();

  if (!conv) return;
  if (conv.ai_user_opt_out || conv.ai_handoff_at || conv.ai_enabled === false) return;

  const debounceUntil = conv.ai_debounce_until ? new Date(conv.ai_debounce_until).getTime() : 0;
  if (debounceUntil > Date.now()) {
    const waitMs = debounceUntil - Date.now() + 100;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const { active, settings, reason } = await isVirtualAssistantActive(supabase, conv.clinic_id);
  if (!active || !settings) {
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "processing_start",
      level: "warn",
      detail: { skipped: true, reason: reason ?? "assistente inativo" },
    });

    const inactive =
      !reason ||
      reason.includes("inativo") ||
      reason.includes("enabled=false") ||
      reason.includes("sem registro");
    if (inactive) {
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .is("ai_processed_at", null);
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "flow_discarded",
        level: "info",
        detail: {
          reason: reason ?? "assistente inativo",
          source: "assistant_inactive",
        },
      });
    }
    return;
  }

  const northStarFlags = isLegacyRuntimeDisabled()
    ? {
        mode: "full" as const,
        brain: "v1" as const,
        canaryClinicIds: [] as string[],
        brainV2CanaryClinicIds: [] as string[],
      }
    : northStarFlagsFromSettings(settings);
  const northStarGate = shouldRunNorthStar(northStarFlags, conv.clinic_id);
  const { shouldUseBrainV2 } = await import("@/lib/conversational/feature-flags");
  const useBrainV2 = shouldUseBrainV2(northStarFlags, conv.clinic_id);

  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: "processing_start",
    detail: { phone: conv.phone_number },
  });

  const { data: pending } = await supabase
    .from("whatsapp_messages")
    .select("id, content, message_type, media_url, media_mime_type, sent_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .order("sent_at", { ascending: true });

  if (!pending?.length) return;

  let aiState = (conv.ai_state ?? {}) as AiConversationState;

  const acquired = await tryAcquireProcessingLock(supabase, conversationId);
  if (!acquired) {
    const retryAt = new Date(Date.now() + 5_000).toISOString();
    await supabase
      .from("whatsapp_conversations")
      .update({ ai_debounce_until: retryAt })
      .eq("id", conversationId);

    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "agent_route",
      detail: {
        engine: "langgraph",
        use_langgraph_pipeline: true,
        lock_acquired: false,
        skipped_reason: "already_processing",
        retry_at: retryAt,
      },
    });
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "debounce_scheduled",
      detail: { debounceSeconds: 5, debounceUntil: retryAt, reason: "lock_busy_retry" },
    });
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "processing_start",
      level: "info",
      detail: { skipped: true, reason: "already_processing", retry_at: retryAt },
    });
    return;
  }

  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: "agent_route",
    detail: northStarGate.run
      ? {
          engine: "north_star",
          north_star_mode: northStarFlags.mode,
          lock_acquired: true,
        }
      : {
          engine: "langgraph",
          use_langgraph_pipeline: true,
          lock_acquired: true,
        },
  });

  if (
    settings.enabled !== false &&
    settings.use_langgraph_pipeline === false
  ) {
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "agent_route",
      level: "warn",
      detail: { warn: "langgraph_disabled_in_settings_overridden_by_runtime" },
    });
  }

  if (conv.patient_id && !aiState.patient_id) {
    aiState = { ...aiState, patient_id: conv.patient_id };
  }

  try {
  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: "pending_messages",
    detail: {
      count: pending.length,
      preview: pending.map((m) => {
        if (m.message_type === "audio") return "[audio]";
        return String(m.content ?? "").slice(0, 40);
      }),
    },
  });

  const resolved = await resolveInboundTexts(
    supabase,
    conv.clinic_id,
    conversationId,
    pending,
    aiState
  );
  aiState = resolved.aiState;

  if (resolved.waitingForTranscription) {
    await scheduleTranscriptionRetry(supabase, conversationId, aiState);
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "pending_messages",
      detail: {
        waitingForTranscription: true,
        jobs: aiState.pending_transcription_jobs?.length ?? 0,
      },
    });
    return;
  }

  const userTexts = resolved.userTexts;

  if (userTexts.length) {
    const combinedInbound = userTexts.join("\n");
    const { checkBotLoopRisk, applyBotLoopSilence } = await import("./bot-loop-guard");
    const loopRisk = await checkBotLoopRisk(
      supabase,
      conversationId,
      conv.clinic_id,
      combinedInbound,
      aiState
    );
    if (loopRisk.block) {
      await applyBotLoopSilence({
        supabase,
        clinicId: conv.clinic_id,
        conversationId,
        phoneNumber: conv.phone_number,
        messageIds: pending.map((m) => m.id),
        reason: loopRisk.reason ?? "process_inbound",
        aiState,
      });
      return;
    }
  }

  if (!userTexts.length) {
    const now = new Date().toISOString();
    await supabase
      .from("whatsapp_messages")
      .update({ ai_processed_at: now })
      .in(
        "id",
        pending.map((m) => m.id)
      );
    await supabase
      .from("whatsapp_conversations")
      .update({
        ai_state: aiState,
        ai_debounce_until: null,
      })
      .eq("id", conversationId);

    if (resolved.audioFailedIds.length > 0) {
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        AUDIO_FALLBACK_MESSAGE
      );
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "reply_sent",
        level: "warn",
        detail: { type: "audio_fallback", failedCount: resolved.audioFailedIds.length },
      });
    }
    return;
  }

  if (!isInsideBotWindow(settings)) {
    const canAuto = await isInsideAutoMessageWindow(conv.clinic_id, supabase);
    if (!canAuto) {
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        formatOutsideHoursReply(settings)
      );
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "reply_sent",
        detail: { type: "outside_hours" },
      });
      return;
    }
  }

  const maxHistory = settings.max_context_messages ?? 20;
  const { data: historyRows } = await supabase
    .from("whatsapp_messages")
    .select("direction, content, sent_at, sender_type, ai_processed_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(maxHistory * 2);

  const history = (historyRows ?? [])
    .reverse()
    .filter((m) => {
      const content = String(m.content ?? "").trim();
      if (!content) return false;
      if (m.direction === "inbound") return Boolean(m.ai_processed_at);
      return true;
    })
    .map((m) => ({
      role:
        m.direction === "inbound"
          ? ("user" as const)
          : m.sender_type === "human"
            ? ("assistant" as const)
            : ("assistant" as const),
      content: String(m.content ?? ""),
    }));

  const combinedText = userTexts.join(" ").toLowerCase();
  const inboundMessage = userTexts.join("\n");

  let inboundIntent = detectInboundIntent(inboundMessage, aiState);
  inboundIntent = resolveContinuityIntent(inboundMessage, aiState, inboundIntent);

  if (shouldContinueBookingFlow(inboundMessage, inboundIntent, aiState)) {
    aiState = applyBookingContinuityStatePatch(aiState);
  } else if (hasClearIntent(inboundIntent) && !aiState.intent) {
    aiState = { ...aiState, ...intentToAiStatePatch(inboundIntent) };
  }

  const { routeInboundFlow } = await import("./intent-router");
  const routed = routeInboundFlow({
    messageText: inboundMessage,
    detectedIntent: inboundIntent,
    aiState,
  });
  if (routed.flow === "booking" || routed.useBookingMachine) {
    if (!aiState.booking_step) {
      aiState = { ...aiState, booking_step: "procedure", intent: "booking" };
    }
  }

  if (aiState.pending_confirmation_appointment_id && aiState.patient_id) {
    const { parseConfirmationReply } = await import("./confirmations");
    const { confirmAppointmentViaAssistant, cancelAppointmentViaAssistant } = await import(
      "./services/appointments"
    );
    const reply = parseConfirmationReply(combinedText);
    if (reply === "yes") {
      const res = await confirmAppointmentViaAssistant(
        supabase,
        conv.clinic_id,
        aiState.pending_confirmation_appointment_id,
        aiState.patient_id
      );
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_last_processed_message_at: now,
          ai_state: { ...aiState, pending_confirmation_appointment_id: undefined, intent: undefined },
          ai_debounce_until: null,
        })
        .eq("id", conversationId);
      await supabase
        .from("whatsapp_ai_confirmation_outreach")
        .update({ confirmed_at: now })
        .eq("appointment_id", aiState.pending_confirmation_appointment_id);
      let msg = "Perfeito! Sua consulta está confirmada. ✅";
      if (res.recommendations) {
        msg += `\n\n📋 Recomendações:\n${res.recommendations}`;
      }
      await sendAssistantReply(supabase, conv.clinic_id, conversationId, conv.phone_number, msg);
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "reply_sent",
        detail: { type: "confirmation_yes" },
      });
      return;
    }
    if (reply === "no_cancel") {
      await cancelAppointmentViaAssistant(
        supabase,
        conv.clinic_id,
        aiState.pending_confirmation_appointment_id,
        aiState.patient_id
      );
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_last_processed_message_at: now,
          ai_state: { ...aiState, pending_confirmation_appointment_id: undefined },
          ai_debounce_until: null,
        })
        .eq("id", conversationId);
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        "Entendido. Sua consulta foi cancelada. Se quiser remarcar, é só me avisar!"
      );
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "reply_sent",
        detail: { type: "confirmation_no_cancel" },
      });
      return;
    }
    if (reply === "no_reschedule") {
      const appointmentId = aiState.pending_confirmation_appointment_id;
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_last_processed_message_at: now,
          ai_state: {
            ...aiState,
            pending_confirmation_appointment_id: undefined,
            pending_reschedule_appointment_id: appointmentId,
            intent: "booking",
          },
          ai_debounce_until: null,
        })
        .eq("id", conversationId);
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        "Sem problema! Vamos remarcar. Qual dia ou turno funciona melhor para você?"
      );
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "reply_sent",
        detail: { type: "confirmation_reschedule" },
      });
      return;
    }
    if (reply === "clarify") {
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_last_processed_message_at: now,
          ai_debounce_until: null,
        })
        .eq("id", conversationId);
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        "Você confirma presença na consulta? Responda *sim*, ou diga se quer *cancelar* ou *remarcar*."
      );
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "reply_sent",
        detail: { type: "confirmation_clarify" },
      });
      return;
    }
  }

  if (aiState.pending_tool_confirmation) {
    const {
      parseToolConfirmationReply,
      isPendingToolConfirmationExpired,
    } = await import("./agent-pipeline/confirmation-policy");
    const { executeAssistantTool } = await import("./tools");

    const pendingTool = aiState.pending_tool_confirmation;
    if (isPendingToolConfirmationExpired(pendingTool)) {
      aiState = { ...aiState, pending_tool_confirmation: undefined };
    } else {
      const toolReply = parseToolConfirmationReply(combinedText);
      if (toolReply === "yes") {
        const toolResult = await executeAssistantTool(
          {
            supabase,
            clinicId: conv.clinic_id,
            conversationId,
            phoneNumber: conv.phone_number,
            aiState,
            skipPipelineValidation: true,
          },
          pendingTool.tool,
          pendingTool.args
        );
        const now = new Date().toISOString();
        await supabase
          .from("whatsapp_messages")
          .update({ ai_processed_at: now })
          .in(
            "id",
            pending.map((m) => m.id)
          );
        let replyText = "Pronto! Ação confirmada.";
        try {
          const parsed = JSON.parse(toolResult.result) as {
            confirmation_message?: string;
            display_message?: string;
            error?: string;
          };
          if (parsed.error) replyText = parsed.error;
          else if (parsed.confirmation_message) replyText = parsed.confirmation_message;
          else if (parsed.display_message) replyText = parsed.display_message;
        } catch {
          /* keep default */
        }
        await supabase
          .from("whatsapp_conversations")
          .update({
            ai_last_processed_message_at: now,
            ai_state: {
              ...aiState,
              ...toolResult.statePatch,
              pending_tool_confirmation: undefined,
            },
            ai_debounce_until: null,
          })
          .eq("id", conversationId);
        await sendAssistantReply(
          supabase,
          conv.clinic_id,
          conversationId,
          conv.phone_number,
          replyText
        );
        logAiEvent(supabase, {
          clinicId: conv.clinic_id,
          conversationId,
          stage: "reply_sent",
          detail: { type: "pipeline_tool_confirmed", tool: pendingTool.tool },
        });
        return;
      }
      if (toolReply === "no") {
        const now = new Date().toISOString();
        await supabase
          .from("whatsapp_messages")
          .update({ ai_processed_at: now })
          .in(
            "id",
            pending.map((m) => m.id)
          );
        await supabase
          .from("whatsapp_conversations")
          .update({
            ai_last_processed_message_at: now,
            ai_state: { ...aiState, pending_tool_confirmation: undefined },
            ai_debounce_until: null,
          })
          .eq("id", conversationId);
        await sendAssistantReply(
          supabase,
          conv.clinic_id,
          conversationId,
          conv.phone_number,
          "Tudo bem, não executei a ação. Como posso ajudar?"
        );
        logAiEvent(supabase, {
          clinicId: conv.clinic_id,
          conversationId,
          stage: "reply_sent",
          detail: { type: "pipeline_tool_cancelled", tool: pendingTool.tool },
        });
        return;
      }
      if (toolReply === null) {
        const now = new Date().toISOString();
        await supabase
          .from("whatsapp_messages")
          .update({ ai_processed_at: now })
          .in(
            "id",
            pending.map((m) => m.id)
          );
        await supabase
          .from("whatsapp_conversations")
          .update({ ai_last_processed_message_at: now, ai_debounce_until: null })
          .eq("id", conversationId);
        await sendAssistantReply(
          supabase,
          conv.clinic_id,
          conversationId,
          conv.phone_number,
          pendingTool.prompt_message ??
            "Confirma esta ação? Responda *sim* ou *não*."
        );
        logAiEvent(supabase, {
          clinicId: conv.clinic_id,
          conversationId,
          stage: "reply_sent",
          detail: { type: "pipeline_tool_clarify", tool: pendingTool.tool },
        });
        return;
      }
    }
  }

  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: useBrainV2 ? "brain_v2_start" : northStarGate.run ? "north_star_start" : "openai_start",
    detail: {
      messageCount: userTexts.length,
      historyCount: userTexts.length,
      ...(northStarGate.run ? { engine: useBrainV2 ? "brain_v2" : "north_star_v1" } : {}),
    },
  });

  const combinedUserText = userTexts.join("\n").trim();
  const { data: faqRows } = await supabase
    .from("clinic_virtual_assistant_faq")
    .select("id, question, answer")
    .eq("clinic_id", conv.clinic_id)
    .order("display_order");

  let northStarResult: Awaited<ReturnType<typeof runNorthStarAssistant>> | null = null;
  if (northStarGate.run && combinedUserText) {
    northStarResult = await runNorthStarAssistant({
      supabase,
      clinicId: conv.clinic_id,
      conversationId,
      phoneNumber: conv.phone_number,
      userText: combinedUserText,
      settings,
      aiState,
      faqs: (faqRows ?? []).map((f) => ({
        id: String(f.id),
        question: String(f.question),
        answer: String(f.answer),
      })),
    }).catch((e) => {
      console.error("[NorthStar] turn error:", e);
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "error",
        level: "error",
        detail: {
          source: "north_star_assistant",
          message: e instanceof Error ? e.message : String(e),
        },
      });
      return { ran: false, shadow: false, sendReply: false };
    });
  }

  let reply: string;
  let handoff: boolean | undefined;
  let statePatch: Partial<AiConversationState> | undefined;

  if (northStarResult?.ran && northStarResult.sendReply && !northStarResult.silent) {
    reply = northStarResult.reply ?? "Como posso ajudar?";
    handoff = northStarResult.handoff;
    statePatch = northStarResult.aiStatePatch ?? aiState;
  } else if (!isLegacyRuntimeDisabled()) {
    const langGraphResult = await runLangGraphAssistant({
      supabase,
      clinicId: conv.clinic_id,
      conversationId,
      phoneNumber: conv.phone_number,
      userMessages: userTexts,
      settings,
      aiState,
      history,
    }).catch((e) => {
      console.error("[VirtualAssistant] agent error:", e);
      const msg =
        e instanceof Error && e.message.includes("OPENAI_API_KEY")
          ? "Desculpe, o assistente não está configurado no momento. Vou chamar alguém da equipe."
          : "Desculpe, tive um problema técnico. Pode tentar de novo em instantes?";
      logAiEvent(supabase, {
        clinicId: conv.clinic_id,
        conversationId,
        stage: "error",
        level: "error",
        detail: {
          source: "langgraph_agent",
          message: e instanceof Error ? e.message : String(e),
        },
      });
      return { reply: msg, handoff: false, statePatch: aiState };
    });
    reply = langGraphResult.reply;
    handoff = langGraphResult.handoff;
    statePatch = langGraphResult.statePatch;
  } else {
    reply = northStarResult?.reply ?? "Como posso ajudar?";
    handoff = northStarResult?.handoff;
    statePatch = northStarResult?.aiStatePatch ?? aiState;
  }

  if (northStarResult?.shadow) {
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "north_star_shadow_compare",
      detail: {
        legacyReplyPreview: reply.slice(0, 120),
        northStarReplyPreview: (northStarResult.reply ?? "").slice(0, 120),
        northStarFsmAfter: northStarResult.fsmStateAfter,
      },
    });
  }

  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: "openai_end",
    detail: {
      handoff,
      replyPreview: reply.slice(0, 80),
      ...(northStarResult?.ran ? { engine: "north_star" } : {}),
    },
  });

  const now = new Date().toISOString();
  await supabase
    .from("whatsapp_messages")
    .update({ ai_processed_at: now })
    .in(
      "id",
      pending.map((m) => m.id)
    );

  let effectiveHandoff = handoff ?? false;
  let effectiveReply = reply;

  if (!effectiveHandoff && effectiveReply.includes(HANDOFF_REPLY_BODY)) {
    console.warn("[VirtualAssistant] handoff reply without flag — normalizing", { conversationId });
    effectiveHandoff = true;
  }

  if (effectiveHandoff) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        ai_handoff_at: now,
        ai_enabled: false,
      })
      .eq("id", conversationId);
  }

  await supabase
    .from("whatsapp_conversations")
    .update({
      ai_last_processed_message_at: now,
      ai_state: statePatch ?? aiState,
      ai_debounce_until: null,
    })
    .eq("id", conversationId);

  const clinicCtx = await buildClinicContext(supabase, conv.clinic_id);
  await ensureAiPrivacyNoticeSent(supabase, {
    conversationId,
    clinicId: conv.clinic_id,
    phoneNumber: conv.phone_number,
    clinicName: clinicCtx.clinicName,
    alreadySent: Boolean(
      (conv as { ai_privacy_notice_sent_at?: string | null }).ai_privacy_notice_sent_at
    ),
  });

  const inboundIds = pending.map((m) => m.id);
  if (shouldSkipDuplicateReply(conversationId, inboundIds, effectiveReply)) {
    logAiEvent(supabase, {
      clinicId: conv.clinic_id,
      conversationId,
      stage: "reply_sent",
      level: "info",
      detail: { skipped: true, reason: "duplicate_reply" },
    });
    return;
  }

  await sendAssistantReply(
    supabase,
    conv.clinic_id,
    conversationId,
    conv.phone_number,
    effectiveReply,
    { skipHeader: await shouldSkipAssistantHeader(supabase, conversationId) }
  );
  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: effectiveHandoff ? "handoff" : "reply_sent",
    detail: { replyPreview: effectiveReply.slice(0, 80) },
  });
  } finally {
    await releaseProcessingLock(supabase, conversationId);
  }
}

export async function scheduleAiDebounce(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string,
  debounceSeconds: number,
  messageId?: string
): Promise<void> {
  const debounceUntil = new Date(Date.now() + debounceSeconds * 1000).toISOString();
  const { error: debounceError } = await supabase
    .from("whatsapp_conversations")
    .update({ ai_debounce_until: debounceUntil })
    .eq("id", conversationId);

  if (debounceError) {
    console.warn("[VirtualAssistant] ai_debounce_until não atualizado:", debounceError.message);
    logAiEvent(supabase, {
      clinicId,
      conversationId,
      stage: "error",
      level: "warn",
      detail: { source: "debounce_update", message: debounceError.message },
    });
  }

  logAiEvent(supabase, {
    clinicId,
    conversationId,
    messageId,
    stage: "debounce_scheduled",
    detail: { debounceSeconds, debounceUntil },
  });

  const runProcessing = async () => {
    await new Promise((r) => setTimeout(r, debounceSeconds * 1000));
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    await processConversationAi(createServiceRoleClient(), conversationId);
  };

  const task = runProcessing().catch((e) => {
    console.error("[VirtualAssistant] processamento falhou:", e);
    logAiEvent(supabase, {
      clinicId,
      conversationId,
      stage: "error",
      level: "error",
      detail: {
        source: "waitUntil",
        message: e instanceof Error ? e.message : String(e),
      },
    });
  });

  // Processamento imediato no mesmo request do webhook (Vercel) — não depende de cron
  waitUntil(task);
  console.info("[VirtualAssistant] agendado via waitUntil (VPS cron é só fallback)", {
    conversationId,
    debounceSeconds,
  });
}

export async function reactivateAiOnPatientInbound(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<boolean> {
  const { active } = await isVirtualAssistantActive(supabase, clinicId);
  if (!active) return false;

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("ai_handoff_at, ai_enabled")
    .eq("id", conversationId)
    .single();

  if (!conv) return false;
  if (!conv.ai_handoff_at && conv.ai_enabled !== false) return false;

  await supabase
    .from("whatsapp_conversations")
    .update({
      ai_handoff_at: null,
      ai_enabled: true,
    })
    .eq("id", conversationId);

  logAiEvent(supabase, {
    clinicId,
    conversationId,
    stage: "ai_reactivated",
    detail: {
      hadHandoff: Boolean(conv.ai_handoff_at),
      hadAiDisabled: conv.ai_enabled === false,
    },
  });

  return true;
}

export async function shouldSkipMenuChatbot(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<SkipMenuChatbotResult> {
  const { active, reason } = await isVirtualAssistantActive(supabase, clinicId);
  if (!active) {
    console.info("[VirtualAssistant] inativo", { clinicId, reason });
    return { skipMenu: false, reason: reason ?? "assistente inativo" };
  }

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("ai_handoff_at, ai_enabled, ai_user_opt_out")
    .eq("id", conversationId)
    .single();

  if (conv?.ai_user_opt_out) {
    return { skipMenu: false, reason: "Paciente desativou respostas de IA (opt-out permanente)" };
  }
  if (conv?.ai_handoff_at) {
    console.info("[VirtualAssistant] conversa em handoff humano", { conversationId });
    return { skipMenu: false, reason: "conversa em handoff humano" };
  }
  if (conv?.ai_enabled === false) {
    return { skipMenu: false, reason: "IA pausada nesta conversa (resposta manual)" };
  }
  return { skipMenu: true };
}

export async function pauseAiOnManualReply(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .update({ ai_enabled: false })
    .eq("id", conversationId);
}
