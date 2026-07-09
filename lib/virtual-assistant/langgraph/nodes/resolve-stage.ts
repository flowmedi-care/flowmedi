import { routeInboundFlow } from "../../intent-router";
import {
  applyPipelineStageTransition,
  collectAllowedToolNames,
  logPipelineStageTransition,
  resolveAgentPipelineStage,
  resolveParallelStages,
} from "../../agent-pipeline";
import { loadContactJourneyForAi } from "@/lib/contact-journey/journey-for-ai";
import { buildContextualResumePrompt } from "@/lib/contact-journey/contextual-resume";
import { bootstrapPatientForBooking } from "../../booking-flow";
import type { GraphState } from "../state";

export async function resolveStageNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const routed = routeInboundFlow({
    messageText: state.inboundText,
    detectedIntent: state.detectedIntent,
    aiState: state.aiState,
  });

  let aiState = { ...state.aiState, intent: routed.intent };

  if (routed.flow === "booking" || routed.useBookingMachine) {
    if (!aiState.booking_step) {
      aiState = { ...aiState, booking_step: "procedure", intent: "booking" };
    }
  }

  const journeyRes = await loadContactJourneyForAi(ctx.supabase, {
    clinicId: ctx.clinicId,
    phone: ctx.phoneNumber,
    patientId: aiState.patient_id,
  }).catch(() => ({ summary: null, journey: null }));

  const journeyStatePatch = journeyRes.journey
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

  const merged = { ...aiState, ...journeyStatePatch };
  const pipelineStage = resolveAgentPipelineStage({
    aiState: merged,
    journey: journeyRes.journey,
    detectedIntent: state.detectedIntent,
    routedFlow: routed.flow,
    patientFound: Boolean(merged.patient_id),
  });

  const parallelStages = resolveParallelStages(
    pipelineStage,
    journeyRes.journey,
    state.detectedIntent
  );

  const stageTransition = applyPipelineStageTransition(
    merged,
    pipelineStage,
    merged.pipeline_stage ? "journey_step" : "initial"
  );

  if (stageTransition.pipeline_stage && ctx) {
    logPipelineStageTransition(ctx.supabase, {
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      fromStage: merged.pipeline_stage,
      toStage: pipelineStage,
      trigger: stageTransition.pipeline_last_transition_trigger as "initial" | "journey_step",
      journeyStepCode: journeyRes.journey?.currentStep,
    });
  }

  const allowedTools = collectAllowedToolNames({
    mainStage: pipelineStage,
    parallelStages,
    includeFinanceRead:
      state.detectedIntent === "payment" || merged.intent === "payment",
  });

  let patientBootstrap = "";
  if (routed.flow === "booking" || routed.useBookingMachine) {
    const boot = await bootstrapPatientForBooking(ctx.supabase, {
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: merged,
    });
    patientBootstrap = boot.promptLine;
    Object.assign(merged, boot.statePatch);
  }

  const journeyBlock = journeyRes.summary
    ? `Jornada do contato (CRM):\n${journeyRes.summary}${
        journeyRes.journey
          ? `\nAbertura contextual: ${buildContextualResumePrompt(journeyRes.journey)}`
          : ""
      }`
    : "";

  return {
    aiState: { ...merged, ...stageTransition, pipeline_stage: pipelineStage },
    routedFlow: routed.flow,
    pipelineStage,
    parallelStages,
    allowedTools,
    journeyBlock,
    patientBootstrap,
  };
}