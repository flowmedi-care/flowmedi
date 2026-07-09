import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";
import { runAgendamentoSubgraph } from "../agendamento/graph";
import { buildSatisfacaoGraph } from "../satisfacao/graph";

export async function posConsultaListNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx || !state.aiState.patient_id) return { needsToolLoop: true };

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "pos_consulta",
    },
    "list_patient_appointments",
    { patient_id: state.aiState.patient_id }
  );

  let parsed: { appointments?: { scheduled_at: string; procedure_name?: string }[]; message?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  const past = (parsed.appointments ?? []).filter(
    (a) => new Date(a.scheduled_at).getTime() <= Date.now()
  );

  if (/retorno|novo agendamento|agendar/i.test(state.inboundText)) {
    const result = await runAgendamentoSubgraph({
      ...state,
      pipelineStage: "agendamento",
      detectedIntent: "booking",
      aiState: { ...state.aiState, intent: "booking", booking_step: "procedure" },
    });
    return result as Partial<GraphState>;
  }

  if (state.aiState.journey_step_code === "pesquisa_nps_enviada" || /nps|nota|avaliação/i.test(state.inboundText)) {
    const graph = buildSatisfacaoGraph();
    const result = await graph.invoke(state);
    return result as Partial<GraphState>;
  }

  const last = past[0];
  const reply = last
    ? applyReplyGuards(
        `Sua última consulta${last.procedure_name ? ` (${last.procedure_name})` : ""} já consta no sistema. Precisa marcar retorno ou tirar dúvida?`,
        state.aiState
      )
    : applyReplyGuards(parsed.message ?? "Como posso ajudar após sua consulta?", state.aiState);

  return mergeStageResult(
    {
      aiState: { ...state.aiState, ...toolResult.statePatch },
      reply,
      stageSubgraphComplete: true,
    },
    "pos_consulta"
  );
}

export function routeAfterPosConsultaList(state: GraphState): "done" | "tool_loop" {
  if (state.stageSubgraphComplete || state.reply?.trim()) return "done";
  if (state.needsToolLoop) return "tool_loop";
  return "done";
}

export async function posConsultaToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop(state);
  return mergeStageResult(result, "pos_consulta");
}
