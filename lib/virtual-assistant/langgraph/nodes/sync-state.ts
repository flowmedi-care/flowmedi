import type { GraphState } from "../state";

export async function syncStateNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const aiState = {
    ...state.aiState,
    pipeline_stage: state.pipelineStage,
    ai_processing_started_at: undefined,
  };

  await ctx.supabase
    .from("whatsapp_conversations")
    .update({ ai_state: aiState })
    .eq("id", ctx.conversationId);

  return { aiState };
}
