import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createChatCompletion,
  logTokenUsage,
  type ChatMessage,
} from "./openai-client";
import { buildBehaviorInstructions, buildKnowledgeContext } from "./knowledge-context";
import { ASSISTANT_TOOLS, executeAssistantTool } from "./tools";
import type { AiConversationState, VirtualAssistantSettings } from "./types";
import { loadContactJourneyForAi } from "@/lib/contact-journey/journey-for-ai";
import { buildContextualResumePrompt } from "@/lib/contact-journey/contextual-resume";
import { shouldEscalateToHuman } from "@/lib/virtual-assistant/escalation";
import { buildAgentPolicyBlock } from "@/lib/virtual-assistant/agent-policy";
import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import {
  detectInboundIntent,
  hasClearIntent,
  intentToAiStatePatch,
} from "@/lib/virtual-assistant/detect-inbound-intent";
import {
  buildToolRoundLimitFallback,
  formatAiStateForPrompt,
} from "@/lib/virtual-assistant/format-ai-state";
import { isInsideHandoffWindow } from "@/lib/virtual-assistant/handoff-hours";

const MAX_TOOL_ROUNDS_DEFAULT = 5;
const MAX_TOOL_ROUNDS_BOOKING = 8;

function resolveMaxToolRounds(state: AiConversationState): number {
  if (state.intent === "booking" || state.pending_confirmation_appointment_id) {
    return MAX_TOOL_ROUNDS_BOOKING;
  }
  return MAX_TOOL_ROUNDS_DEFAULT;
}

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
      reply:
        "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?",
    };
  }

  const detectedIntent = detectInboundIntent(combinedUserText);
  let workingState: AiConversationState = { ...opts.aiState };
  if (hasClearIntent(detectedIntent) && !workingState.intent) {
    workingState = { ...workingState, ...intentToAiStatePatch(detectedIntent) };
  }

  const escalation = shouldEscalateToHuman({
    messageText: combinedUserText,
    lossConfidence: workingState.confianca ?? null,
    followupCount: workingState.followup_count,
    confirmationStep: Boolean(workingState.pending_confirmation_appointment_id),
  });
  const inActiveBooking = workingState.intent === "booking";
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

  const knowledge = await buildKnowledgeContext(opts.supabase, opts.clinicId);
  const behavior = buildBehaviorInstructions(opts.settings);
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
    ? `\n\nJornada do contato (CRM — use para orientar próximo passo):\n${journeyRes.summary}`
    : "";
  const resumeHint = journeyRes.journey
    ? `\nAbertura contextual sugerida: ${buildContextualResumePrompt(journeyRes.journey)}`
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

  const stateForPrompt = formatAiStateForPrompt({ ...workingState, ...journeyStatePatch });

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${knowledge}\n\n${behavior}\n\n${buildAgentPolicyBlock()}${journeyBlock}${resumeHint}\n\nEstado da conversa:\n${stateForPrompt}`,
    },
  ];

  const maxHistory = opts.settings.max_context_messages ?? 20;
  for (const h of opts.history.slice(-maxHistory)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: combinedUserText });

  let statePatch: Partial<AiConversationState> = { ...workingState, ...journeyStatePatch };
  const maxRounds = resolveMaxToolRounds(statePatch as AiConversationState);
  let rounds = 0;

  while (rounds < maxRounds) {
    rounds++;
    const completion = await createChatCompletion({
      model,
      messages,
      tools: ASSISTANT_TOOLS,
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

        const toolResult = await executeAssistantTool(
          {
            supabase: opts.supabase,
            clinicId: opts.clinicId,
            conversationId: opts.conversationId,
            phoneNumber: opts.phoneNumber,
            aiState: statePatch as AiConversationState,
          },
          tc.function.name,
          args
        );

        if (toolResult.statePatch) {
          statePatch = { ...statePatch, ...toolResult.statePatch };
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
      continue;
    }

    const reply =
      completion.content?.trim() ||
      "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?";
    return { reply, statePatch };
  }

  return {
    reply: buildToolRoundLimitFallback(statePatch as AiConversationState),
    statePatch,
  };
}
