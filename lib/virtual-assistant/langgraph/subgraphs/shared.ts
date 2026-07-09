import type { AgentPipelineStage } from "../../agent-pipeline/stages";
import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export type SubgraphRunner = (state: GraphState) => Promise<Partial<GraphState>>;

export function createToolLoopSubgraph(_stage: AgentPipelineStage): SubgraphRunner {
  return runStageToolLoop;
}
