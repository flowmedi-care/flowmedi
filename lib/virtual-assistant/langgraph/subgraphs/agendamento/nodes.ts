import {
  tryAutoFetchAvailableSlots,
  tryExecuteBookingSlotSelection,
} from "@/lib/operational-agents/booking-executor";
import { getClinicTimezone } from "@/lib/clinic-timezone";
import { maybeResetBookingForFreshRequest } from "@/lib/virtual-assistant/booking-reset";
import { tryHandleBookingMeta, bootstrapPatientForBooking } from "@/lib/virtual-assistant/booking-flow";
import { buildToolRoundLimitFallback } from "@/lib/virtual-assistant/format-ai-state";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";

function withAgendamento(patch: Partial<GraphState>): Partial<GraphState> {
  return mergeStageResult(
    {
      ...patch,
      aiState: { ...patch.aiState, intent: "booking", pipeline_stage: "agendamento" },
    },
    "agendamento"
  );
}

export async function agendamentoResetNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};
  const clinicTz = await getClinicTimezone(ctx.supabase, ctx.clinicId);
  const aiState = maybeResetBookingForFreshRequest(
    state.inboundText,
    { ...state.aiState, intent: "booking" },
    state.detectedIntent,
    { timeZone: clinicTz }
  );
  return { aiState };
}

export async function agendamentoMetaNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};
  const meta = await tryHandleBookingMeta(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    messageText: state.inboundText,
    aiState: state.aiState,
  });
  if (!meta.handled) return {};
  return withAgendamento({
    aiState: { ...state.aiState, ...meta.statePatch },
    reply: applyReplyGuards(meta.reply, state.aiState),
    stageSubgraphComplete: true,
  });
}

export function routeAfterAgendamentoMeta(state: GraphState): "done" | "continue" {
  return state.stageSubgraphComplete ? "done" : "continue";
}

export async function agendamentoBootstrapNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};
  const boot = await bootstrapPatientForBooking(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    aiState: state.aiState,
  });
  return { aiState: { ...state.aiState, ...boot.statePatch }, patientBootstrap: boot.promptLine };
}

export async function agendamentoSlotNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};
  const slotExec = await tryExecuteBookingSlotSelection(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    messageText: state.inboundText,
    aiState: state.aiState,
  });
  if (!slotExec.handled) return {};
  return withAgendamento({
    aiState: { ...state.aiState, ...slotExec.statePatch },
    reply: applyReplyGuards(slotExec.reply, state.aiState),
    stageSubgraphComplete: true,
  });
}

export function routeAfterAgendamentoSlot(state: GraphState): "done" | "continue" {
  return state.stageSubgraphComplete ? "done" : "continue";
}

async function listProceduresReply(state: GraphState): Promise<Partial<GraphState> | null> {
  const ctx = state.runtimeContext;
  if (!ctx) return null;
  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "agendamento",
    },
    "list_procedures",
    { doctor_id: state.aiState.doctor_id }
  );
  let parsed: { procedures?: { id: string; name: string }[] } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }
  const procedures = parsed.procedures ?? [];
  if (procedures.length === 0) {
    return withAgendamento({
      reply: "No momento não encontrei procedimentos cadastrados. Posso chamar alguém da equipe para ajudar?",
      stageSubgraphComplete: true,
    });
  }
  const list = procedures.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}`).join("\n");
  return withAgendamento({
    aiState: { ...state.aiState, booking_step: "procedure", intent: "booking" },
    reply: applyReplyGuards(
      `Para verificar horários, qual procedimento ou tipo de consulta você quer?\n\n${list}`,
      state.aiState
    ),
    stageSubgraphComplete: true,
  });
}

async function listDoctorsReply(state: GraphState): Promise<Partial<GraphState> | null> {
  const ctx = state.runtimeContext;
  if (!ctx) return null;
  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "agendamento",
    },
    "list_doctors",
    {}
  );
  let parsed: { doctors?: { id: string; full_name: string }[] } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }
  const doctors = parsed.doctors ?? [];
  if (doctors.length === 0) {
    return withAgendamento({
      reply: "Não encontrei profissionais disponíveis agora. Quer falar com a equipe?",
      stageSubgraphComplete: true,
    });
  }
  const list = doctors.slice(0, 10).map((d, i) => `${i + 1}. ${d.full_name}`).join("\n");
  return withAgendamento({
    aiState: { ...state.aiState, booking_step: "doctor", intent: "booking" },
    reply: applyReplyGuards(`Com qual profissional você prefere agendar?\n\n${list}`, state.aiState),
    stageSubgraphComplete: true,
  });
}

export async function agendamentoEnsureDataNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.aiState.procedure_id) {
    const ask = await listProceduresReply(state);
    if (ask) return ask;
  }
  if (!state.aiState.doctor_id) {
    const ask = await listDoctorsReply(state);
    if (ask) return ask;
  }
  return {};
}

export function routeAfterAgendamentoEnsure(state: GraphState): "done" | "fetch" {
  return state.stageSubgraphComplete ? "done" : "fetch";
}

export async function agendamentoFetchSlotsNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};
  const autoSlots = await tryAutoFetchAvailableSlots(ctx.supabase, {
    clinicId: ctx.clinicId,
    aiState: state.aiState,
  });
  if (autoSlots.handled) {
    return withAgendamento({
      aiState: { ...state.aiState, ...autoSlots.statePatch },
      reply: applyReplyGuards(autoSlots.reply, state.aiState),
      stageSubgraphComplete: true,
    });
  }
  return {};
}

export function routeAfterAgendamentoFetch(state: GraphState): "done" | "fallback" {
  return state.stageSubgraphComplete ? "done" : "fallback";
}

export async function agendamentoFallbackNode(state: GraphState): Promise<Partial<GraphState>> {
  if (
    state.detectedIntent === "availability_check" ||
    state.missingSlots.length > 0
  ) {
    const fallback = buildToolRoundLimitFallback({ ...state.aiState, intent: "booking" });
    return withAgendamento({
      reply: applyReplyGuards(fallback, state.aiState),
      stageSubgraphComplete: true,
    });
  }
  return {};
}

export function routeAfterAgendamentoFallback(state: GraphState): "done" | "tool_loop" {
  return state.stageSubgraphComplete ? "done" : "tool_loop";
}

export async function agendamentoToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop(state);
  const patch = withAgendamento(result);
  if (result.aiState?.last_created_appointment_id) {
    return mergeStageResult(
      {
        ...patch,
        aiState: {
          ...patch.aiState,
          pipeline_stage: "confirmacao_pre_consulta",
        },
        pipelineStage: "confirmacao_pre_consulta",
      },
      "confirmacao_pre_consulta"
    );
  }
  return patch;
}
