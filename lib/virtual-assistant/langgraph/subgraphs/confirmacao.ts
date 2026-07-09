import { parseConfirmationReply } from "../../confirmations";
import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export async function confirmacaoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  if (
    state.detectedIntent === "reschedule" ||
    state.detectedIntent === "cancel" ||
    state.detectedIntent === "my_appointments"
  ) {
    return runStageToolLoop({
      ...state,
      aiState: {
        ...state.aiState,
        intent:
          state.detectedIntent === "cancel"
            ? "cancel"
            : state.detectedIntent === "my_appointments"
              ? "my_appointments"
              : "booking",
      },
    });
  }

  const confirmReply = parseConfirmationReply(state.inboundText.toLowerCase());
  if (confirmReply !== null && confirmReply !== "clarify") {
    return runStageToolLoop(state);
  }

  return runStageToolLoop(state);
}
