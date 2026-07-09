import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "../event-log";
import type { AiConversationState, VirtualAssistantSettings } from "../types";
import { getAssistantGraph } from "./graph";
import type { GraphHistoryMessage } from "./state";
import { logLangGraphTrace } from "./trace";

export type RunLangGraphAssistantInput = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userMessages: string[];
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  history: GraphHistoryMessage[];
};

export type RunLangGraphAssistantResult = {
  reply: string;
  handoff?: boolean;
  statePatch?: Partial<AiConversationState>;
};

export async function runLangGraphAssistant(
  input: RunLangGraphAssistantInput
): Promise<RunLangGraphAssistantResult> {
  const combinedUserText = input.userMessages.join("\n").trim();
  if (!combinedUserText) {
    return {
      reply: "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?",
    };
  }

  const graph = await getAssistantGraph();

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
    detail: { messageCount: input.userMessages.length },
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
      pipeline_stage: result.pipelineStage,
      detected_intent: result.detectedIntent,
      intent_confidence: result.intentConfidence,
      handoff: result.handoff,
      reply_source: result.replySource ?? (result.hadReplyBeforeCompose ? "subgraph" : "fallback"),
      had_reply_before_compose: result.hadReplyBeforeCompose,
      compose_skipped: result.replySource !== "compose_llm",
      inbound_preview: combinedUserText.slice(0, 80),
      reply_preview: reply.slice(0, 120),
    },
  });

  logLangGraphTrace(input.supabase, input.clinicId, input.conversationId, {
    node: "run_complete",
    detected_intent: result.detectedIntent,
    intent_confidence: result.intentConfidence,
    pipeline_stage: result.pipelineStage,
    reply_source: result.replySource ?? undefined,
    had_reply_before_compose: result.hadReplyBeforeCompose,
    compose_skipped: result.replySource !== "compose_llm",
    inbound_preview: combinedUserText.slice(0, 80),
    reply_preview: reply.slice(0, 120),
  });

  return {
    reply,
    handoff: result.handoff,
    statePatch: result.aiState,
  };
}
