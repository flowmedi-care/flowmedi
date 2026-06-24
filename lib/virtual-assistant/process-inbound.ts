import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import {
  AUDIO_FALLBACK_MESSAGE,
  resolveInboundTexts,
  scheduleTranscriptionRetry,
} from "./audio-transcription";
import { runVirtualAssistantAgent } from "./agent";
import { logAiEvent } from "./event-log";
import { sendAssistantReply } from "./send-reply";
import type { AiConversationState, VirtualAssistantSettings } from "./types";
import { isInsideAutoMessageWindow } from "@/lib/whatsapp-ops-controls";

export interface SkipMenuChatbotResult {
  skipMenu: boolean;
  reason?: string;
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

  // Se o admin ativou no painel, honrar em runtime (gate de plano só na UI)
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
      "id, clinic_id, phone_number, ai_enabled, ai_handoff_at, ai_debounce_until, ai_state, patient_id"
    )
    .eq("id", conversationId)
    .single();

  if (!conv) return;
  if (conv.ai_handoff_at || conv.ai_enabled === false) return;

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
    return;
  }

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

  let aiState = (conv.ai_state ?? {}) as AiConversationState;
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
        "No momento estamos fora do horário de atendimento automático. Deixe sua mensagem que retornamos em breve!"
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
    .select("direction, content, sent_at")
    .eq("conversation_id", conversationId)
    .not("ai_processed_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(maxHistory * 2);

  const history = (historyRows ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: String(m.content ?? ""),
    }))
    .filter((m) => m.content.trim());

  const combinedText = userTexts.join(" ").toLowerCase();
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
    if (reply === "no") {
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
        detail: { type: "confirmation_no" },
      });
      return;
    }
  }

  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: "openai_start",
    detail: { messageCount: userTexts.length },
  });

  const { reply, handoff, statePatch } = await runVirtualAssistantAgent({
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
        source: "openai_agent",
        message: e instanceof Error ? e.message : String(e),
      },
    });
    return { reply: msg, handoff: false, statePatch: aiState };
  });

  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: "openai_end",
    detail: { handoff, replyPreview: reply.slice(0, 80) },
  });

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
      ai_state: statePatch ?? aiState,
      ai_debounce_until: null,
    })
    .eq("id", conversationId);

  await sendAssistantReply(supabase, conv.clinic_id, conversationId, conv.phone_number, reply);
  logAiEvent(supabase, {
    clinicId: conv.clinic_id,
    conversationId,
    stage: handoff ? "handoff" : "reply_sent",
    detail: { replyPreview: reply.slice(0, 80) },
  });
}

export async function scheduleAiDebounce(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string,
  debounceSeconds: number
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
    .select("ai_handoff_at, ai_enabled")
    .eq("id", conversationId)
    .single();

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
