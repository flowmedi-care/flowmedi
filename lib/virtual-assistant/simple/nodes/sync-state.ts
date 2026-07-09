import type { GraphState } from "../../langgraph/state";
import type { AgentPipelineStage } from "../../agent-pipeline/stages";

const ROUTE_TO_STAGE: Record<string, AgentPipelineStage> = {
  greeting: "captacao",
  discovery: "captacao",
  pricing: "orcamento",
  booking: "agendamento",
  handoff: "captacao",
  agent: "captacao",
};

/** Persiste ai_state sem derivar estágio CRM. */
export async function simpleSyncStateNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const { ai_processing_started_at: _removed, ...restAiState } = state.aiState;
  const pipelineStage =
    state.pipelineStage ?? ROUTE_TO_STAGE[state.assistantRoute] ?? "captacao";

  const aiState = {
    ...restAiState,
    pipeline_stage: pipelineStage,
    intent:
      state.assistantRoute === "booking"
        ? "booking"
        : state.assistantRoute === "pricing"
          ? "pricing"
          : restAiState.intent,
  };

  await ctx.supabase
    .from("whatsapp_conversations")
    .update({ ai_state: aiState })
    .eq("id", ctx.conversationId);

  return { aiState, pipelineStage };
}
