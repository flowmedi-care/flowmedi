import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function confirmacaoSubgraph(state: GraphState) {
  return invokeStageSubgraph("confirmacao_pre_consulta", state);
}
