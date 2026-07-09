import { END, START, StateGraph } from "@langchain/langgraph";
import type { GraphState } from "../state";
import { GraphStateAnnotation } from "../state";

export type StageNode = (state: GraphState) => Promise<Partial<GraphState>>;

export type StageEdgeRouter = (state: GraphState) => string;

export type StageGraphConfig = {
  nodes: Record<string, StageNode>;
  edges: Array<{ from: string; to: string }>;
  conditionalEdges?: Array<{
    from: string;
    router: StageEdgeRouter;
    mapping: Record<string, string>;
  }>;
  entry: string;
  terminals: string[];
};

export function compileStageGraph(config: StageGraphConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph = new StateGraph(GraphStateAnnotation) as any;

  for (const [name, fn] of Object.entries(config.nodes)) {
    graph.addNode(name, fn);
  }

  graph.addEdge(START, config.entry);

  for (const { from, to } of config.edges) {
    graph.addEdge(from, to);
  }

  for (const term of config.terminals) {
    graph.addEdge(term, END);
  }

  if (config.conditionalEdges) {
    for (const { from, router, mapping } of config.conditionalEdges) {
      graph.addConditionalEdges(from, router, mapping);
    }
  }

  return graph.compile() as {
    invoke: (state: GraphState) => Promise<GraphState>;
  };
}

export function mergeStageResult(
  patch: Partial<GraphState>,
  pipelineStage: GraphState["pipelineStage"]
): Partial<GraphState> {
  return {
    ...patch,
    pipelineStage,
    aiState: {
      ...(patch.aiState ?? {}),
      pipeline_stage: pipelineStage,
    },
  };
}
