import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";

function withOrcamento(patch: Partial<GraphState>): Partial<GraphState> {
  return mergeStageResult(
    { ...patch, aiState: { ...patch.aiState, intent: "pricing" } },
    "orcamento"
  );
}

export async function orcamentoResolveNode(state: GraphState): Promise<Partial<GraphState>> {
  if (state.aiState.resolve_quote_offer_done) return {};
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "orcamento",
    },
    "resolve_quote_offer",
    {
      procedure_id: state.aiState.procedure_id,
      service_id: state.aiState.service_id,
      doctor_id: state.aiState.doctor_id,
    }
  );

  let parsed: {
    needsDoctorChoice?: boolean;
    message?: string;
    doctors?: { id: string; full_name: string }[];
  } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  if (parsed.needsDoctorChoice && parsed.doctors?.length) {
    const list = parsed.doctors
      .slice(0, 8)
      .map((d, i) => `${i + 1}. ${d.full_name}`)
      .join("\n");
    return withOrcamento({
      aiState: { ...state.aiState, ...toolResult.statePatch, resolve_quote_offer_done: true },
      reply: applyReplyGuards(
        `${parsed.message ?? "Com qual profissional?"}\n\n${list}`,
        state.aiState
      ),
      stageSubgraphComplete: true,
    });
  }

  return {
    aiState: {
      ...state.aiState,
      ...toolResult.statePatch,
      resolve_quote_offer_done: true,
    },
  };
}

export function routeAfterOrcamentoResolve(state: GraphState): "done" | "send" | "status" {
  if (state.stageSubgraphComplete) return "done";
  if (state.detectedIntent === "quote" || /orçamento|orcamento|enviar/i.test(state.inboundText)) {
    return "send";
  }
  if (/status|andamento|enviado/i.test(state.inboundText)) return "status";
  return "send";
}

export async function orcamentoSendNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return { needsToolLoop: true };

  const pending = state.aiState.pending_tool_confirmation;
  if (pending?.tool === "create_and_send_quote") {
    return { needsToolLoop: true, needsHumanConfirm: true };
  }

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "orcamento",
    },
    "create_and_send_quote",
    {
      procedure_id: state.aiState.procedure_id,
      service_id: state.aiState.service_id,
      doctor_id: state.aiState.doctor_id,
      patient_id: state.aiState.patient_id,
    }
  );

  if (toolResult.handoff) {
    return withOrcamento({ handoff: true, stageSubgraphComplete: true });
  }

  let parsed: { message?: string; display_message?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  const reply = parsed.display_message ?? parsed.message;
  if (reply) {
    return withOrcamento({
      aiState: { ...state.aiState, ...toolResult.statePatch },
      reply: applyReplyGuards(reply, state.aiState),
      stageSubgraphComplete: true,
    });
  }

  return { needsToolLoop: true };
}

export async function orcamentoStatusNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return { needsToolLoop: true };

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "orcamento",
    },
    "get_quote_status",
    { patient_id: state.aiState.patient_id }
  );

  let parsed: { message?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  return withOrcamento({
    aiState: { ...state.aiState, ...toolResult.statePatch },
    reply: applyReplyGuards(parsed.message ?? "Consultei o status do seu orçamento.", state.aiState),
    stageSubgraphComplete: true,
  });
}

export function routeAfterOrcamentoSend(state: GraphState): "done" | "tool_loop" {
  if (state.stageSubgraphComplete || state.handoff) return "done";
  if (state.needsToolLoop || state.needsHumanConfirm) return "tool_loop";
  return "done";
}

export async function orcamentoToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop({
    ...state,
    aiState: { ...state.aiState, intent: "pricing" },
  });
  return withOrcamento(result);
}
