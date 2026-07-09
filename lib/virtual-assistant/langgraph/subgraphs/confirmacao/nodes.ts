import { parseConfirmationReply } from "@/lib/virtual-assistant/confirmations";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";

function withConfirmacao(patch: Partial<GraphState>): Partial<GraphState> {
  return mergeStageResult(patch, "confirmacao_pre_consulta");
}

export async function confirmacaoLoadNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx || state.aiState.pending_confirmation_appointment_id) return {};
  if (!state.aiState.patient_id) return {};

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "confirmacao_pre_consulta",
    },
    "list_patient_appointments",
    { patient_id: state.aiState.patient_id }
  );

  let parsed: { appointments?: { id: string; scheduled_at: string }[] } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  const upcoming = (parsed.appointments ?? []).filter(
    (a) => new Date(a.scheduled_at).getTime() > Date.now()
  );
  if (upcoming.length === 1) {
    return {
      aiState: {
        ...state.aiState,
        ...toolResult.statePatch,
        pending_confirmation_appointment_id: upcoming[0]!.id,
        intent: "confirm_appointment",
      },
    };
  }
  return { aiState: { ...state.aiState, ...toolResult.statePatch } };
}

export async function confirmacaoParseNode(state: GraphState): Promise<Partial<GraphState>> {
  if (
    state.detectedIntent === "reschedule" ||
    state.detectedIntent === "cancel" ||
    state.detectedIntent === "my_appointments"
  ) {
    return { needsToolLoop: true };
  }

  const parsed = parseConfirmationReply(state.inboundText.toLowerCase());
  if (parsed === null || parsed === "clarify") {
    return { needsToolLoop: true };
  }

  return {};
}

export function routeAfterConfirmacaoParse(state: GraphState): "tool_loop" | "action" {
  if (state.needsToolLoop) return "tool_loop";
  return "action";
}

export async function confirmacaoActionNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};
  const reply = parseConfirmationReply(state.inboundText.toLowerCase());
  if (reply === null || reply === "clarify") return { needsToolLoop: true };

  const appointmentId = state.aiState.pending_confirmation_appointment_id;
  if (!appointmentId) return { needsToolLoop: true };

  if (reply === "no_reschedule") {
    return mergeStageResult(
      {
        pipelineStage: "agendamento",
        aiState: {
          ...state.aiState,
          intent: "booking",
          booking_step: "day",
          pending_reschedule_appointment_id: appointmentId,
          pending_confirmation_appointment_id: undefined,
        },
        needsToolLoop: true,
      },
      "agendamento"
    );
  }

  if (reply === "yes") {
    const toolResult = await executeAssistantTool(
      {
        supabase: ctx.supabase,
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        phoneNumber: ctx.phoneNumber,
        aiState: state.aiState,
        pipelineStage: "confirmacao_pre_consulta",
      },
      "confirm_appointment",
      { appointment_id: appointmentId }
    );
    let parsed: { message?: string } = {};
    try {
      parsed = JSON.parse(toolResult.result);
    } catch {
      parsed = {};
    }
    return withConfirmacao({
      aiState: {
        ...state.aiState,
        ...toolResult.statePatch,
        pending_confirmation_appointment_id: undefined,
        confirmation_completed: ["2d"],
      },
      reply: applyReplyGuards(parsed.message ?? "Presença confirmada. Até lá!", state.aiState),
      stageSubgraphComplete: true,
    });
  }

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "confirmacao_pre_consulta",
    },
    "cancel_appointment",
    { appointment_id: appointmentId, reason: "Paciente respondeu não na confirmação" }
  );
  let parsed: { message?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }
  return mergeStageResult(
    {
      aiState: {
        ...state.aiState,
        ...toolResult.statePatch,
        pending_confirmation_appointment_id: undefined,
        pipeline_stage: "captacao",
      },
      pipelineStage: "captacao",
      reply: applyReplyGuards(parsed.message ?? "Consulta cancelada. Posso ajudar com algo mais?", state.aiState),
      stageSubgraphComplete: true,
    },
    "captacao"
  );
}

export async function confirmacaoToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const intent =
    state.detectedIntent === "cancel"
      ? "cancel"
      : state.detectedIntent === "my_appointments"
        ? "my_appointments"
        : state.detectedIntent === "reschedule"
          ? "booking"
          : state.aiState.intent;
  const result = await runStageToolLoop({
    ...state,
    aiState: { ...state.aiState, intent: intent ?? "confirm_appointment" },
  });
  return withConfirmacao(result);
}
