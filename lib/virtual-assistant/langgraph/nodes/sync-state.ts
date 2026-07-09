import type { GraphState } from "../state";

export async function syncStateNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const { ai_processing_started_at: _removed, ...restAiState } = state.aiState;
  const aiState = {
    ...restAiState,
    pipeline_stage: state.pipelineStage,
  };

  await ctx.supabase
    .from("whatsapp_conversations")
    .update({ ai_state: aiState })
    .eq("id", ctx.conversationId);

  return { aiState };
}
