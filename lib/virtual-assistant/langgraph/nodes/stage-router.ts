import type { AgentPipelineStage } from "../../agent-pipeline/stages";
import type { GraphState } from "../state";
import { buildFinanceiroGraph } from "../subgraphs/financeiro/graph";
import { buildFormulariosGraph } from "../subgraphs/formularios/graph";
import { invokeStageSubgraph } from "../subgraphs/registry";

export async function stageRouterNode(state: GraphState): Promise<Partial<GraphState>> {
  const stage = state.pipelineStage;
  const result = await invokeStageSubgraph(stage, state);

  if (
    state.parallelStages.includes("financeiro") &&
    stage !== "financeiro" &&
    (state.detectedIntent === "payment" || state.aiState.intent === "payment")
  ) {
    const financeGraph = buildFinanceiroGraph();
    const financeResult = await financeGraph.invoke({ ...state, ...result });
    if ((financeResult as GraphState).reply) return financeResult as Partial<GraphState>;
  }

  if (
    state.parallelStages.includes("formularios") &&
    stage !== "formularios" &&
    state.detectedIntent === "form"
  ) {
    const formGraph = buildFormulariosGraph();
    const formResult = await formGraph.invoke({ ...state, ...result });
    if ((formResult as GraphState).reply) return formResult as Partial<GraphState>;
  }

  return result;
}

export function routeAfterStage(state: GraphState): "compose" | "confirm" | "tool_loop" | "handoff" {
  if (state.handoff) return "handoff";
  if (state.needsHumanConfirm || state.aiState.pending_tool_confirmation) return "confirm";
  if (state.needsToolLoop) return "tool_loop";
  if (state.reply?.trim()) return "compose";
  if (state.stageSubgraphComplete) return "compose";
  return "compose";
}

export function stageRouterEdge(state: GraphState): AgentPipelineStage {
  return state.pipelineStage;
}
