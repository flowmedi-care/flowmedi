import type { AgentPipelineStage } from "../../agent-pipeline/stages";
import type { GraphState } from "../state";

export type SubgraphRunner = (state: GraphState) => Promise<Partial<GraphState>>;

/** Registry central de subgrafos compilados — ver registry.ts */
export type { SubgraphRunner as StageSubgraphRunner };

export function stageSubgraphLabel(stage: AgentPipelineStage): string {
  return stage;
}
