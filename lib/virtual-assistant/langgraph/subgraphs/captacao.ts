import { isSlotSelectionMessage } from "@/lib/operational-agents/booking-executor";
import { hasActiveBookingContext, hasOfferedBookingSelection } from "../../booking-continuity";
import type { GraphState } from "../state";
import { agendamentoSubgraph } from "./agendamento";
import { orcamentoSubgraph } from "./orcamento";
import { runStageToolLoop } from "../tools/tool-node";

function shouldDelegateToAgendamento(state: GraphState): boolean {
  if (hasActiveBookingContext(state.aiState)) return true;
  if (!isSlotSelectionMessage(state.inboundText)) return false;
  if (!state.aiState.procedure_id || !state.aiState.doctor_id) return false;
  return (
    hasOfferedBookingSelection(state.aiState) ||
    Boolean(state.aiState.booking_step && state.aiState.booking_step !== "done")
  );
}

export async function captacaoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  if (state.detectedIntent === "pricing" || state.detectedIntent === "quote") {
    return orcamentoSubgraph({
      ...state,
      pipelineStage: "orcamento",
      aiState: { ...state.aiState, intent: "pricing" },
    });
  }

  if (
    state.detectedIntent === "booking" ||
    state.detectedIntent === "availability_check" ||
    shouldDelegateToAgendamento(state)
  ) {
    return agendamentoSubgraph({
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
  }

  if (state.detectedIntent === "greeting") {
    const { applyReplyGuards } = await import("../../reply-guards");
    return {
      reply: applyReplyGuards(
        "Olá! Posso ajudar com:\n1. Agendar consulta\n2. Valores e procedimentos\n3. Falar com a equipe\n\nO que você precisa?",
        state.aiState
      ),
      stageSubgraphComplete: true,
    };
  }

  return runStageToolLoop(state);
}
