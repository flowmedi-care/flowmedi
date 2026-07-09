import { routeInboundFlow } from "../../intent-router";
import {
  maybeResetBookingForFreshRequest,
  clearDormantBookingOnIntentConflict,
} from "../../booking-reset";
import { getClinicTimezone } from "@/lib/clinic-timezone";
import {
  applyPipelineStageTransition,
  collectAllowedToolNames,
  logPipelineStageTransition,
  resolveAgentPipelineStage,
  resolveParallelStages,
  parseToolConfirmationReply,
} from "../../agent-pipeline";
import { loadContactJourneyForAi } from "@/lib/contact-journey/journey-for-ai";
import { buildContextualResumePrompt } from "@/lib/contact-journey/contextual-resume";
import { bootstrapPatientForBooking } from "../../booking-flow";
import { applyReplyGuards } from "../../reply-guards";
import { resolveGlobalAction } from "../../routing/action-table";
import { invokeStageSubgraph } from "../subgraphs/registry";
import { buildFinanceiroGraph } from "../subgraphs/financeiro/graph";
import { buildFormulariosGraph } from "../subgraphs/formularios/graph";
import { runStageToolLoop } from "../tools/tool-node";
import type { GraphState } from "../state";
import { logLangGraphTrace } from "../trace";
import { bookingContinuityNode } from "./booking-continuity";

export async function routeAndExecuteNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const pending = state.aiState.pending_tool_confirmation;
  if (pending) {
    const reply = parseToolConfirmationReply(state.inboundText);
    if (reply === null) {
      return {
        needsHumanConfirm: true,
        reply: pending.prompt_message ?? "Confirma esta ação? Responda *sim* ou *não*.",
        stageSubgraphComplete: true,
      };
    }
    if (reply === "no") {
      return {
        aiState: { ...state.aiState, pending_tool_confirmation: undefined },
        reply: "Tudo bem, não executei a ação. Como posso ajudar?",
        stageSubgraphComplete: true,
      };
    }
    state = {
      ...state,
      aiState: { ...state.aiState, pending_tool_confirmation: undefined },
      needsToolLoop: true,
    };
  }

  const continuityResult = await bookingContinuityNode(state);
  if (continuityResult.reply?.trim() && continuityResult.stageSubgraphComplete) {
    return continuityResult;
  }

  const mergedContinuity = { ...state, ...continuityResult };

  let aiStateForRoute = clearDormantBookingOnIntentConflict(
    mergedContinuity.aiState,
    mergedContinuity.detectedIntent
  );

  const routed = routeInboundFlow({
    messageText: mergedContinuity.inboundText,
    detectedIntent: mergedContinuity.detectedIntent,
    aiState: aiStateForRoute,
  });

  const clinicTz = await getClinicTimezone(ctx.supabase, ctx.clinicId);
  let aiState = maybeResetBookingForFreshRequest(
    mergedContinuity.inboundText,
    { ...aiStateForRoute, intent: routed.intent },
    mergedContinuity.detectedIntent,
    { timeZone: clinicTz }
  );

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
    detectedIntent: mergedContinuity.detectedIntent,
    routedFlow: routed.flow,
    patientFound: Boolean(merged.patient_id),
  });

  const parallelStages = resolveParallelStages(
    pipelineStage,
    journeyRes.journey,
    mergedContinuity.detectedIntent
  );

  const stageTransition = applyPipelineStageTransition(
    merged,
    pipelineStage,
    merged.pipeline_stage ? "journey_step" : "initial"
  );

  if (stageTransition.pipeline_stage) {
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
      mergedContinuity.detectedIntent === "payment" || merged.intent === "payment",
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

  const workingState: GraphState = {
    ...mergedContinuity,
    aiState: { ...merged, ...stageTransition },
    routedFlow: routed.flow,
    pipelineStage,
    parallelStages,
    allowedTools,
    journeyBlock,
    patientBootstrap,
  };

  const action = resolveGlobalAction({
    derivedStage: pipelineStage,
    bookingStep: merged.booking_step,
    detectedIntent: mergedContinuity.detectedIntent,
    aiState: workingState.aiState,
    hasReply: Boolean(workingState.reply?.trim()),
  });

  logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
    node: "route_and_execute",
    detected_intent: mergedContinuity.detectedIntent,
    pipeline_stage: pipelineStage,
    routed_flow: routed.flow,
  });

  if (action.type === "pass_through") {
    return workingState;
  }

  if (action.type === "deterministic_reply") {
    return {
      ...workingState,
      pipelineStage: action.stage ?? pipelineStage,
      reply: applyReplyGuards(action.reply, workingState.aiState),
      replySource: "deterministic",
      stageSubgraphComplete: true,
    };
  }

  if (action.type === "booking_handler" || action.type === "invoke_subgraph") {
    const stage = action.type === "booking_handler" ? "agendamento" : action.stage;
    let result = await invokeStageSubgraph(stage, workingState);

    if (
      parallelStages.includes("financeiro") &&
      stage !== "financeiro" &&
      (mergedContinuity.detectedIntent === "payment" || workingState.aiState.intent === "payment")
    ) {
      const financeGraph = buildFinanceiroGraph();
      const financeResult = await financeGraph.invoke({ ...workingState, ...result });
      if ((financeResult as GraphState).reply) result = financeResult as Partial<GraphState>;
    }

    if (
      parallelStages.includes("formularios") &&
      stage !== "formularios" &&
      mergedContinuity.detectedIntent === "form"
    ) {
      const formGraph = buildFormulariosGraph();
      const formResult = await formGraph.invoke({ ...workingState, ...result });
      if ((formResult as GraphState).reply) result = formResult as Partial<GraphState>;
    }

    if (result.reply?.trim() && !result.replySource) {
      result = { ...result, replySource: "subgraph" as const };
    }

    const combined = { ...workingState, ...result };

    if (combined.reply?.trim() || combined.handoff) {
      return combined;
    }

    if (combined.needsHumanConfirm || combined.aiState.pending_tool_confirmation) {
      return combined;
    }

    if (combined.needsToolLoop) {
      const toolResult = await runStageToolLoop(combined);
      return { ...combined, ...toolResult };
    }

    if (!combined.reply?.trim() && !combined.stageSubgraphComplete) {
      const toolResult = await runStageToolLoop(combined);
      return { ...combined, ...toolResult };
    }

    return combined;
  }

  if (action.type === "bounded_tool_loop") {
    const toolResult = await runStageToolLoop(workingState);
    return { ...workingState, ...toolResult };
  }

  return workingState;
}
