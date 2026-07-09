import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export async function posConsultaSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  return runStageToolLoop(state);
}
