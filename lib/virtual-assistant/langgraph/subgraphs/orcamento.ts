import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export async function orcamentoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  return runStageToolLoop({
    ...state,
    aiState: { ...state.aiState, intent: "pricing" },
  });
}
