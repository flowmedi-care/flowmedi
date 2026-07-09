import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export async function formulariosSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  return runStageToolLoop({
    ...state,
    pipelineStage: "formularios",
  });
}
