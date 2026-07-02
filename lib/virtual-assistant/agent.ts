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

const MAX_TOOL_ROUNDS = 5;

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
    return { reply: "Não consegui entender sua mensagem. Pode repetir?" };
  }

  const escalation = shouldEscalateToHuman({ messageText: combinedUserText });
  const inActiveBooking = opts.aiState.intent === "booking";
  if (
    escalation.escalate &&
    opts.settings.human_handoff_enabled !== false &&
    !inActiveBooking
  ) {
    const handoffResult = await executeAssistantTool(
      {
        supabase: opts.supabase,
        clinicId: opts.clinicId,
        conversationId: opts.conversationId,
        phoneNumber: opts.phoneNumber,
        aiState: opts.aiState,
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
      patientId: opts.aiState.patient_id,
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

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${knowledge}\n\n${behavior}\n\n${buildAgentPolicyBlock()}${journeyBlock}${resumeHint}\n\nEstado atual da conversa: ${JSON.stringify(opts.aiState)}`,
    },
  ];

  const maxHistory = opts.settings.max_context_messages ?? 20;
  for (const h of opts.history.slice(-maxHistory)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: combinedUserText });

  let statePatch: Partial<AiConversationState> = { ...opts.aiState, ...journeyStatePatch };
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const completion = await createChatCompletion({
      model,
      messages,
      tools: ASSISTANT_TOOLS,
      temperature: 0.5,
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
      "Desculpe, não consegui processar. Pode reformular sua mensagem?";
    return { reply, statePatch };
  }

  return {
    reply: "Preciso de mais informações. Pode me contar um pouco mais?",
    statePatch,
  };
}
