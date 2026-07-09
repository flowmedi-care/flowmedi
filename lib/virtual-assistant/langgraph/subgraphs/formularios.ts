import type { GraphState } from "../state";
import { invokeStageSubgraph } from "./registry";

export async function formulariosSubgraph(state: GraphState) {
  return invokeStageSubgraph("formularios", state);
}
