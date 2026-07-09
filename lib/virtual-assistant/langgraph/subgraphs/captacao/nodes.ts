import { hasActiveBookingContext, hasOfferedBookingSelection } from "@/lib/virtual-assistant/booking-continuity-guards";
import { isSlotSelectionMessage } from "@/lib/virtual-assistant/booking-slot-messages";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";
import { runAgendamentoSubgraph } from "../agendamento/graph";
import { buildOrcamentoGraph } from "../orcamento/graph";

function shouldDelegateToAgendamento(state: GraphState): boolean {
  if (hasActiveBookingContext(state.aiState)) return true;
  if (!isSlotSelectionMessage(state.inboundText)) return false;
  if (!state.aiState.procedure_id || !state.aiState.doctor_id) return false;
  return (
    hasOfferedBookingSelection(state.aiState) ||
    Boolean(state.aiState.booking_step && state.aiState.booking_step !== "done")
  );
}

export async function captacaoRouteNode(state: GraphState): Promise<Partial<GraphState>> {
  if (state.detectedIntent === "pricing" || state.detectedIntent === "quote") {
    const graph = buildOrcamentoGraph();
    const result = await graph.invoke({
      ...state,
      pipelineStage: "orcamento",
      aiState: { ...state.aiState, intent: "pricing" },
    });
    return result as Partial<GraphState>;
  }

  if (
    state.detectedIntent === "booking" ||
    state.detectedIntent === "availability_check" ||
    shouldDelegateToAgendamento(state)
  ) {
    const result = await runAgendamentoSubgraph({
      ...state,
      pipelineStage: "agendamento",
      detectedIntent:
        state.detectedIntent === "unknown" ? "availability_check" : state.detectedIntent,
      aiState: {
        ...state.aiState,
        intent: "booking",
        booking_step: state.aiState.booking_step ?? "day",
      },
    });
    return result as Partial<GraphState>;
  }

  if (state.detectedIntent === "greeting") {
    return mergeStageResult(
      {
        reply: applyReplyGuards(
          "Olá! Posso ajudar com:\n1. Agendar consulta\n2. Valores e procedimentos\n3. Falar com a equipe\n\nO que você precisa?",
          state.aiState
        ),
        stageSubgraphComplete: true,
      },
      "captacao"
    );
  }

  return { needsToolLoop: true };
}

export function routeAfterCaptacaoRoute(state: GraphState): "done" | "discovery" {
  if (state.stageSubgraphComplete || state.reply?.trim()) return "done";
  if (state.needsToolLoop) return "discovery";
  return "done";
}

export async function captacaoDiscoveryNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop(state);
  return mergeStageResult(result, "captacao");
}
