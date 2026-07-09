import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function captacaoSubgraph(state: GraphState) {
  return invokeStageSubgraph("captacao", state);
}
