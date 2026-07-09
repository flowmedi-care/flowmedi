import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function orcamentoSubgraph(state: GraphState) {
  return invokeStageSubgraph("orcamento", state);
}
