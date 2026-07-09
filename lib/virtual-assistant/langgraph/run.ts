import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "../event-log";
import type { AiConversationState, VirtualAssistantSettings } from "../types";
import { getAssistantGraph } from "./graph";
import type { GraphHistoryMessage } from "./state";

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
    aiState: { ...input.aiState, ai_processing_started_at: new Date().toISOString() },
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
      handoff: result.handoff,
    },
  });

  return {
    reply,
    handoff: result.handoff,
    statePatch: result.aiState,
  };
}
