import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function identificacaoSubgraph(state: GraphState) {
  return invokeStageSubgraph("identificacao", state);
}
