import { compileStageGraph } from "../build-stage-graph";
import {
  posConsultaListNode,
  posConsultaToolLoopNode,
  routeAfterPosConsultaList,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildPosConsultaGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "list",
    terminals: ["terminal"],
    nodes: {
      list: posConsultaListNode,
      tool_loop: posConsultaToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "list",
        router: routeAfterPosConsultaList,
        mapping: { done: "terminal", tool_loop: "tool_loop" },
      },
    ],
  });

  return compiled;
}

export function resetPosConsultaGraphForTests(): void {
  compiled = null;
}
