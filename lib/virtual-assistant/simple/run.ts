import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "../event-log";
import type { AiConversationState, VirtualAssistantSettings } from "../types";
import type { GraphHistoryMessage } from "../langgraph/state";
import { logLangGraphTrace } from "../langgraph/trace";
import { getSimpleAssistantGraph } from "./graph";

export type RunSimpleAssistantInput = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userMessages: string[];
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  history: GraphHistoryMessage[];
};

export type RunSimpleAssistantResult = {
  reply: string;
  handoff?: boolean;
  statePatch?: Partial<AiConversationState>;
};

export async function runSimpleAssistant(
  input: RunSimpleAssistantInput
): Promise<RunSimpleAssistantResult> {
  const combinedUserText = input.userMessages.join("\n").trim();
  if (!combinedUserText) {
    return {
      reply: "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?",
    };
  }

  const graph = await getSimpleAssistantGraph();

  const initialState = {
    inboundText: combinedUserText,
    userMessages: input.userMessages,
    history: input.history,
    aiState: { ...input.aiState },
    runtimeContext: {
      supabase: input.supabase,
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      phoneNumber: input.phoneNumber,
      settings: input.settings,
    },
  };

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: "langgraph_start",
    detail: { messageCount: input.userMessages.length, engine: "simple" },
  });

  const result = await graph.invoke(initialState, {
    configurable: { thread_id: input.conversationId },
  });

  const reply =
    result.reply?.trim() ||
    "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?";

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: "langgraph_complete",
    detail: {
      engine: "simple",
      assistant_route: result.assistantRoute,
      route_source: result.routeSource,
      detected_intent: result.detectedIntent,
      intent_confidence: result.intentConfidence,
      handoff: result.handoff,
      reply_source: result.replySource,
      inbound_preview: combinedUserText.slice(0, 80),
      reply_preview: reply.slice(0, 120),
    },
  });

  logLangGraphTrace(input.supabase, input.clinicId, input.conversationId, {
    node: "simple_run_complete",
    detected_intent: result.detectedIntent,
    intent_confidence: result.intentConfidence,
    routed_flow: result.assistantRoute,
    reply_source: result.replySource ?? undefined,
    inbound_preview: combinedUserText.slice(0, 80),
    reply_preview: reply.slice(0, 120),
  });

  return {
    reply,
    handoff: result.handoff,
    statePatch: result.aiState,
  };
}

export function shouldUseSimpleAssistant(settings: Partial<VirtualAssistantSettings>): boolean {
  if (settings.use_simple_assistant === false) return false;
  return true;
}
