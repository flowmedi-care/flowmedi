import {
  tryAutoFetchAvailableSlots,
  tryExecuteBookingSlotSelection,
} from "@/lib/operational-agents/booking-executor";
import { tryHandleBookingMeta, bootstrapPatientForBooking } from "../../booking-flow";
import { buildToolRoundLimitFallback } from "../../format-ai-state";
import { applyReplyGuards } from "../../reply-guards";
import { executeAssistantTool } from "../../tools";
import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

function withAgendamentoResult(patch: Partial<GraphState>): Partial<GraphState> {
  const mergedAiState = {
    ...patch.aiState,
    pipeline_stage: "agendamento" as const,
    intent: "booking" as const,
  };
  return {
    ...patch,
    aiState: mergedAiState,
    pipelineStage: "agendamento",
  };
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

  let parsed: { procedures?: { id: string; name: string }[]; hint?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  const procedures = parsed.procedures ?? [];
  if (procedures.length === 0) {
    return withAgendamentoResult({
      reply: "No momento não encontrei procedimentos cadastrados. Posso chamar alguém da equipe para ajudar?",
      stageSubgraphComplete: true,
    });
  }

  const list = procedures
    .slice(0, 10)
    .map((p, i) => `${i + 1}. ${p.name}`)
    .join("\n");

  return withAgendamentoResult({
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
    return withAgendamentoResult({
      reply: "Não encontrei profissionais disponíveis agora. Quer falar com a equipe?",
      stageSubgraphComplete: true,
    });
  }

  const list = doctors
    .slice(0, 10)
    .map((d, i) => `${i + 1}. ${d.full_name}`)
    .join("\n");

  return withAgendamentoResult({
    aiState: { ...state.aiState, booking_step: "doctor", intent: "booking" },
    reply: applyReplyGuards(`Com qual profissional você prefere agendar?\n\n${list}`, state.aiState),
    stageSubgraphComplete: true,
  });
}

export async function agendamentoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  let aiState = { ...state.aiState, intent: "booking" };

  const meta = await tryHandleBookingMeta(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    messageText: state.inboundText,
    aiState,
  });
  if (meta.handled) {
    return withAgendamentoResult({
      aiState: { ...aiState, ...meta.statePatch },
      reply: applyReplyGuards(meta.reply, aiState),
      stageSubgraphComplete: true,
    });
  }

  const boot = await bootstrapPatientForBooking(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    aiState,
  });
  aiState = { ...aiState, ...boot.statePatch };

  const slotExec = await tryExecuteBookingSlotSelection(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    messageText: state.inboundText,
    aiState,
  });
  if (slotExec.handled) {
    return withAgendamentoResult({
      aiState: { ...aiState, ...slotExec.statePatch },
      reply: applyReplyGuards(slotExec.reply, aiState),
      stageSubgraphComplete: true,
    });
  }

  if (!aiState.procedure_id) {
    const ask = await listProceduresReply({ ...state, aiState });
    if (ask) return ask;
  }

  if (!aiState.doctor_id) {
    const ask = await listDoctorsReply({ ...state, aiState });
    if (ask) return ask;
  }

  const autoSlots = await tryAutoFetchAvailableSlots(ctx.supabase, {
    clinicId: ctx.clinicId,
    aiState,
  });
  if (autoSlots.handled) {
    return withAgendamentoResult({
      aiState: { ...aiState, ...autoSlots.statePatch },
      reply: applyReplyGuards(autoSlots.reply, aiState),
      stageSubgraphComplete: true,
    });
  }

  if (
    state.detectedIntent === "availability_check" ||
    state.missingSlots.length > 0
  ) {
    const fallback = buildToolRoundLimitFallback({
      ...aiState,
      intent: "booking",
    });
    return withAgendamentoResult({
      aiState,
      reply: applyReplyGuards(fallback, aiState),
      stageSubgraphComplete: true,
    });
  }

  const toolLoopResult = await runStageToolLoop({ ...state, aiState });
  return withAgendamentoResult(toolLoopResult);
}
