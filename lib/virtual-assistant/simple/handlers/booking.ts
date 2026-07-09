import { runAgendamentoSubgraph } from "../../langgraph/subgraphs/agendamento/graph";
import { bookingContinuityNode } from "../../langgraph/nodes/booking-continuity";
import type { GraphState } from "../../langgraph/state";
import type { PartialGraphUpdate } from "./shared";

export async function handleBooking(state: GraphState): Promise<PartialGraphUpdate> {
  const continuity = await bookingContinuityNode(state);
  if (continuity.reply?.trim() && continuity.stageSubgraphComplete) {
    return {
      ...continuity,
      replySource: continuity.replySource ?? "continuity",
      pipelineStage: "agendamento",
    };
  }

  const merged: GraphState = { ...state, ...continuity };
  const result = await runAgendamentoSubgraph({
    ...merged,
    pipelineStage: "agendamento",
    detectedIntent:
      merged.detectedIntent === "unknown" ? "availability_check" : merged.detectedIntent,
    aiState: {
      ...merged.aiState,
      intent: "booking",
      booking_step: merged.aiState.booking_step ?? "procedure",
    },
  });

  return {
    ...result,
    pipelineStage: "agendamento",
    replySource: result.replySource ?? (result.needsToolLoop ? "tool_loop" : "subgraph"),
  };
}
