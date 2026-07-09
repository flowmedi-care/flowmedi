import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function financeiroSubgraph(state: GraphState) {
  return invokeStageSubgraph("financeiro", state);
}
