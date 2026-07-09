import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function satisfacaoSubgraph(state: GraphState) {
  return invokeStageSubgraph("satisfacao", state);
}
