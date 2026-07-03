import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createChatCompletion,
  logTokenUsage,
  type ChatMessage,
} from "./openai-client";
import { executeAssistantTool } from "./tools";
import type { AiConversationState, VirtualAssistantSettings } from "./types";
import { loadContactJourneyForAi } from "@/lib/contact-journey/journey-for-ai";
import { buildContextualResumePrompt } from "@/lib/contact-journey/contextual-resume";
import { shouldEscalateToHuman } from "@/lib/virtual-assistant/escalation";
import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import {
  detectInboundIntent,
  hasClearIntent,
  intentToAiStatePatch,
} from "@/lib/virtual-assistant/detect-inbound-intent";
import { buildToolRoundLimitFallback } from "@/lib/virtual-assistant/format-ai-state";
import { isInsideHandoffWindow } from "@/lib/virtual-assistant/handoff-hours";
import { buildClinicContext } from "@/lib/virtual-assistant/clinic-context";
import { composeSystemPrompt } from "@/lib/virtual-assistant/prompt/prompt-compose";
import { routeInboundFlow } from "@/lib/virtual-assistant/intent-router";
import {
  bootstrapPatientForBooking,
  tryHandleBookingMeta,
} from "@/lib/virtual-assistant/booking-flow";
import {
  isActiveBookingState,
  tryExecuteBookingSlotSelection,
} from "@/lib/operational-agents/booking-executor";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import {
  resolveAgentPipelineStage,
  resolveParallelStages,
  filterToolsForStage,
  applyPipelineStageTransition,
  logPipelineStageTransition,
  extractToolExecutionModesFromSettings,
  requiresHumanConfirm,
  createPendingToolConfirmation,
  logPipelineConfirmationPending,
  patchStateFromToolResult,
  resetToolFailureCount,
  incrementToolFailureCount,
  MAX_CONSECUTIVE_TOOL_FAILURES,
} from "@/lib/virtual-assistant/agent-pipeline";

const MAX_TOOL_ROUNDS_DEFAULT = 5;
const MAX_TOOL_ROUNDS_BOOKING = 8;

const HANDOFF_PATTERNS = [
  /falar com (um(a)? )?(atendente|humano|pessoa)/i,
  /quero (um )?atendente/i,
  /quero falar com (algu[eé]m|uma pessoa)/i,
  /\batendente humano\b/i,
  /reclama[çc][aã]o/,
];

export function shouldAutoHandoff(text: string): boolean {
  return HANDOFF_PATTERNS.some((p) => p.test(text));
}

function resolveMaxToolRounds(state: AiConversationState): number {
  if (state.intent === "booking" || state.booking_step || state.pending_confirmation_appointment_id) {
    return MAX_TOOL_ROUNDS_BOOKING;
  }
  return MAX_TOOL_ROUNDS_DEFAULT;
}

function extractConfirmationFromToolResults(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "tool" || m.name !== "create_appointment") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}") as { confirmation_message?: string };
      if (parsed.confirmation_message) return parsed.confirmation_message;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function runVirtualAssistantAgent(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userMessages: string[];
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<{ reply: string; handoff?: boolean; statePatch?: Partial<AiConversationState> }> {
  const combinedUserText = opts.userMessages.join("\n").trim();
  if (!combinedUserText) {
    return {
      reply: "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?",
    };
  }

  const detectedIntent = detectInboundIntent(combinedUserText);
  let workingState: AiConversationState = { ...opts.aiState };
  if (hasClearIntent(detectedIntent) && !workingState.intent && !workingState.booking_step) {
    workingState = { ...workingState, ...intentToAiStatePatch(detectedIntent) };
  }

  const routed = routeInboundFlow({
    messageText: combinedUserText,
    detectedIntent,
    aiState: workingState,
  });
  workingState = { ...workingState, intent: routed.intent };

  if (routed.useBookingMachine) {
    const meta = await tryHandleBookingMeta(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      messageText: combinedUserText,
      aiState: workingState,
    });
    if (meta.handled) {
      return { reply: meta.reply, statePatch: { ...workingState, ...meta.statePatch } };
    }

    const boot = await bootstrapPatientForBooking(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      aiState: workingState,
    });
    workingState = { ...workingState, ...boot.statePatch };

    const slotExec = await tryExecuteBookingSlotSelection(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      messageText: combinedUserText,
      aiState: workingState,
    });
    if (slotExec.handled) {
      return { reply: slotExec.reply, statePatch: { ...workingState, ...slotExec.statePatch } };
    }
  }

  const escalation = shouldEscalateToHuman({
    messageText: combinedUserText,
    lossConfidence: workingState.confianca ?? null,
    followupCount: workingState.followup_count,
    confirmationStep: Boolean(workingState.pending_confirmation_appointment_id),
    activeBooking: isActiveBookingState(workingState),
  });
  const inActiveBooking = isActiveBookingState(workingState);
  if (
    escalation.escalate &&
    opts.settings.human_handoff_enabled !== false &&
    !inActiveBooking &&
    isInsideHandoffWindow(opts.settings)
  ) {
    const handoffResult = await executeAssistantTool(
      {
        supabase: opts.supabase,
        clinicId: opts.clinicId,
        conversationId: opts.conversationId,
        phoneNumber: opts.phoneNumber,
        aiState: workingState,
      },
      "transfer_to_human",
      { reason: escalation.trigger ?? "auto_keyword" }
    );
    return {
      reply: HANDOFF_REPLY_BODY,
      handoff: handoffResult.handoff,
    };
  }

  const clinicCtx = await buildClinicContext(opts.supabase, opts.clinicId);
  const assistantName = clinicCtx.settings.assistant_name ?? "assistente virtual";

  let patientBootstrap = "";
  let bootstrapPatch: Partial<AiConversationState> = {};
  if (routed.flow === "booking" || routed.useBookingMachine) {
    const boot = await bootstrapPatientForBooking(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      aiState: workingState,
    });
    patientBootstrap = boot.promptLine;
    bootstrapPatch = boot.statePatch;
    workingState = { ...workingState, ...bootstrapPatch };
  }

  const model = opts.settings.ai_model ?? "gpt-4o-mini";

  let journeyRes: Awaited<ReturnType<typeof loadContactJourneyForAi>> = {
    summary: null,
    journey: null,
  };
  try {
    journeyRes = await loadContactJourneyForAi(opts.supabase, {
      clinicId: opts.clinicId,
      phone: opts.phoneNumber,
      patientId: workingState.patient_id,
    });
  } catch (e) {
    console.warn("[VirtualAssistant] jornada CRM ignorada:", e);
  }
  const journeyBlock = journeyRes.summary
    ? `Jornada do contato (CRM):\n${journeyRes.summary}`
    : "";
  const resumeHint = journeyRes.journey
    ? `Abertura contextual sugerida: ${buildContextualResumePrompt(journeyRes.journey)}`
    : "";

  const journeyStatePatch: Partial<AiConversationState> = journeyRes.journey
    ? {
        journey_step_code: journeyRes.journey.currentStep,
        contact_intent: journeyRes.journey.contactIntent,
        motivo_provavel: journeyRes.journey.motivoProvavel ?? undefined,
        confianca: journeyRes.journey.lossConfidence ?? undefined,
        focused_appointment_id: journeyRes.journey.appointmentId ?? undefined,
        active_appointments: journeyRes.journey.appointmentId
          ? [journeyRes.journey.appointmentId]
          : undefined,
      }
    : {};

  const mergedForStage = { ...workingState, ...journeyStatePatch };
  const pipelineStage = resolveAgentPipelineStage({
    aiState: mergedForStage,
    journey: journeyRes.journey,
    detectedIntent,
    routedFlow: routed.flow,
    patientFound: Boolean(mergedForStage.patient_id),
  });
  const parallelStages = resolveParallelStages(
    pipelineStage,
    journeyRes.journey,
    detectedIntent
  );
  const stageTransition = applyPipelineStageTransition(
    mergedForStage,
    pipelineStage,
    mergedForStage.pipeline_stage ? "journey_step" : "initial"
  );
  if (stageTransition.pipeline_stage) {
    logPipelineStageTransition(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      fromStage: mergedForStage.pipeline_stage,
      toStage: pipelineStage,
      trigger: stageTransition.pipeline_last_transition_trigger as "initial" | "journey_step",
      journeyStepCode: journeyRes.journey?.currentStep,
    });
  }

  const toolExecutionModes = extractToolExecutionModesFromSettings(opts.settings);
  const allowedTools = filterToolsForStage({
    mainStage: pipelineStage,
    parallelStages,
    includeFinanceRead:
      detectedIntent === "payment" || mergedForStage.intent === "payment",
  });

  const pipelineBlock = `Pipeline do agente (etapa atual): ${pipelineStage}${
    parallelStages.length ? ` (+ paralelo: ${parallelStages.join(", ")})` : ""
  }. Use apenas as ferramentas disponíveis nesta etapa.`;

  const systemContent = composeSystemPrompt({
    clinicName: clinicCtx.clinicName,
    assistantName,
    settings: clinicCtx.settings,
    clinicData: clinicCtx.text,
    flow: routed.flow,
    aiState: { ...mergedForStage, ...stageTransition },
    journeyBlock: journeyBlock || undefined,
    resumeHint: resumeHint || undefined,
    whatsappPhone: opts.phoneNumber,
    patientBootstrap: patientBootstrap || undefined,
    pipelineBlock,
  });

  const messages: ChatMessage[] = [{ role: "system", content: systemContent }];

  const maxHistory = opts.settings.max_context_messages ?? 20;
  for (const h of opts.history.slice(-maxHistory)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: combinedUserText });

  let statePatch: Partial<AiConversationState> = {
    ...workingState,
    ...journeyStatePatch,
    ...stageTransition,
    pipeline_stage: pipelineStage,
  };
  const maxRounds = resolveMaxToolRounds(statePatch as AiConversationState);
  let rounds = 0;

  while (rounds < maxRounds) {
    rounds++;
    const completion = await createChatCompletion({
      model,
      messages,
      tools: allowedTools,
      temperature: 0.2,
    });
    logTokenUsage(opts.clinicId, completion.usage);

    if (completion.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: completion.content ?? null,
        tool_calls: completion.tool_calls,
      });

      for (const tc of completion.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }

        if (requiresHumanConfirm(tc.function.name, toolExecutionModes)) {
          const pending = createPendingToolConfirmation(tc.function.name, args);
          logPipelineConfirmationPending(opts.supabase, {
            clinicId: opts.clinicId,
            conversationId: opts.conversationId,
            toolName: tc.function.name,
            stage: pipelineStage,
          });
          return {
            reply: pending.prompt_message ?? "Confirma esta ação? Responda sim ou não.",
            statePatch: {
              ...statePatch,
              pending_tool_confirmation: pending,
            },
          };
        }

        const toolResult = await executeAssistantTool(
          {
            supabase: opts.supabase,
            clinicId: opts.clinicId,
            conversationId: opts.conversationId,
            phoneNumber: opts.phoneNumber,
            aiState: statePatch as AiConversationState,
            pipelineStage,
            parallelStages,
            toolExecutionModes,
          },
          tc.function.name,
          args
        );

        let parsedResult: Record<string, unknown> = {};
        try {
          parsedResult = JSON.parse(toolResult.result) as Record<string, unknown>;
        } catch {
          parsedResult = {};
        }

        const toolFailed = Boolean(parsedResult.error);
        const resultPatch = patchStateFromToolResult(
          tc.function.name,
          args,
          parsedResult,
          statePatch as AiConversationState
        );

        if (toolResult.statePatch) {
          statePatch = { ...statePatch, ...toolResult.statePatch };
        }
        if (Object.keys(resultPatch).length) {
          statePatch = { ...statePatch, ...resultPatch };
        }
        statePatch = {
          ...statePatch,
          ...(toolFailed
            ? incrementToolFailureCount(statePatch as AiConversationState)
            : resetToolFailureCount()),
        };

        if (
          toolFailed &&
          (statePatch.consecutive_tool_failures ?? 0) >= MAX_CONSECUTIVE_TOOL_FAILURES &&
          opts.settings.human_handoff_enabled !== false
        ) {
          const handoffResult = await executeAssistantTool(
            {
              supabase: opts.supabase,
              clinicId: opts.clinicId,
              conversationId: opts.conversationId,
              phoneNumber: opts.phoneNumber,
              aiState: statePatch as AiConversationState,
              skipPipelineValidation: true,
            },
            "transfer_to_human",
            { reason: "repeated_tool_failures" }
          );
          if (handoffResult.handoff) {
            return { reply: HANDOFF_REPLY_BODY, handoff: true, statePatch };
          }
        }

        if (toolResult.handoff) {
          return {
            reply: HANDOFF_REPLY_BODY,
            handoff: true,
            statePatch,
          };
        }

        messages.push({
          role: "tool",
          content: toolResult.result,
          tool_call_id: tc.id,
          name: tc.function.name,
        });
      }

      const confirmationMsg = extractConfirmationFromToolResults(messages);
      if (confirmationMsg) {
        return {
          reply: applyReplyGuards(confirmationMsg, statePatch as AiConversationState),
          statePatch,
        };
      }

      continue;
    }

    let reply =
      completion.content?.trim() ||
      "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?";
    reply = applyReplyGuards(reply, statePatch as AiConversationState);
    return { reply, statePatch };
  }

  let fallback = buildToolRoundLimitFallback(statePatch as AiConversationState);

  if (isActiveBookingState(statePatch as AiConversationState)) {
    const slotExec = await tryExecuteBookingSlotSelection(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      messageText: combinedUserText,
      aiState: statePatch as AiConversationState,
    });
    if (slotExec.handled) {
      return {
        reply: applyReplyGuards(slotExec.reply, {
          ...(statePatch as AiConversationState),
          ...slotExec.statePatch,
        }),
        statePatch: { ...statePatch, ...slotExec.statePatch },
      };
    }
  }

  fallback = applyReplyGuards(fallback, statePatch as AiConversationState);
  return { reply: fallback, statePatch };
}
