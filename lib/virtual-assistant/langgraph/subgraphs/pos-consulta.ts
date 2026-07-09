import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function posConsultaSubgraph(state: GraphState) {
  return invokeStageSubgraph("pos_consulta", state);
}
