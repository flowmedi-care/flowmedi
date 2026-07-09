import { Annotation } from "@langchain/langgraph";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentPipelineStage } from "../agent-pipeline/stages";
import type { InboundIntent } from "../detect-inbound-intent";
import type { PromptFlow } from "../prompt/prompt-decision";
import type {
  AiConversationState,
  VirtualAssistantSettings,
} from "../types";
import type { ClassifiedIntent, IntentEntities } from "./intent-schema";

export type GraphHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GraphRuntimeContext = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  settings: Partial<VirtualAssistantSettings>;
};

function mergeAiState(
  prev: AiConversationState,
  next: Partial<AiConversationState>
): AiConversationState {
  return { ...prev, ...next };
}

function mergeRecord<T extends Record<string, unknown>>(prev: T, next: Partial<T>): T {
  return { ...prev, ...next };
}

export const GraphStateAnnotation = Annotation.Root({
  aiState: Annotation<AiConversationState>({
    reducer: mergeAiState,
    default: () => ({}),
  }),
  inboundText: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  userMessages: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  history: Annotation<GraphHistoryMessage[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  detectedIntent: Annotation<InboundIntent>({
    reducer: (_prev, next) => next,
    default: () => "unknown" as InboundIntent,
  }),
  classifiedIntent: Annotation<ClassifiedIntent | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  intentConfidence: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  entities: Annotation<IntentEntities>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  missingSlots: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  routedFlow: Annotation<PromptFlow>({
    reducer: (_prev, next) => next,
    default: () => "general" as PromptFlow,
  }),
  pipelineStage: Annotation<AgentPipelineStage>({
    reducer: (_prev, next) => next,
    default: () => "captacao" as AgentPipelineStage,
  }),
  parallelStages: Annotation<AgentPipelineStage[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  allowedTools: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  reply: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  handoff: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  stageSubgraphComplete: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  needsHumanConfirm: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  needsToolLoop: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  clinicDataText: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  journeyBlock: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  patientBootstrap: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  runtimeContext: Annotation<GraphRuntimeContext | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type GraphState = typeof GraphStateAnnotation.State;
export type GraphStateUpdate = typeof GraphStateAnnotation.Update;

export function extractAiStatePatch(state: GraphState): Partial<AiConversationState> {
  const { aiState } = state;
  return {
    ...aiState,
    pipeline_stage: state.pipelineStage,
    intent: aiState.intent ?? state.routedFlow,
  };
}
