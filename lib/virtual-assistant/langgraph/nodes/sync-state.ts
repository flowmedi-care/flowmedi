import type { GraphState } from "../state";
import {
  deriveRuntimeStage,
  syncDerivedPipelineStage,
} from "../../conversation-state/derive-runtime-stage";
import {
  logPipelineStageTransition,
} from "../../agent-pipeline/transitions";

export async function syncStateNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const { ai_processing_started_at: _removed, ...restAiState } = state.aiState;

  const derivedStage = deriveRuntimeStage({
    aiState: restAiState,
    detectedIntent: state.detectedIntent,
    routedFlow: state.routedFlow,
    patientFound: Boolean(restAiState.patient_id),
  });

  const stagePatch = syncDerivedPipelineStage(restAiState, derivedStage, "journey_step");

  if (stagePatch.pipeline_stage && ctx) {
    logPipelineStageTransition(ctx.supabase, {
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      fromStage: restAiState.pipeline_stage,
      toStage: derivedStage,
      trigger: "journey_step",
      journeyStepCode: restAiState.journey_step_code,
    });
  }

  const aiState = {
    ...restAiState,
    ...stagePatch,
    pipeline_stage: derivedStage,
  };

  await ctx.supabase
    .from("whatsapp_conversations")
    .update({ ai_state: aiState })
    .eq("id", ctx.conversationId);

  return { aiState, pipelineStage: derivedStage };
}
