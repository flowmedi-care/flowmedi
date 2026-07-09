import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export async function satisfacaoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  return runStageToolLoop({
    ...state,
    pipelineStage: "satisfacao",
  });
}
