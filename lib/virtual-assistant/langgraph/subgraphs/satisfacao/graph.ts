import { compileStageGraph } from "../build-stage-graph";
import {
  routeAfterSatisfacaoParse,
  satisfacaoCollectNode,
  satisfacaoParseNode,
  satisfacaoToolLoopNode,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildSatisfacaoGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "parse",
    terminals: ["terminal"],
    nodes: {
      parse: satisfacaoParseNode,
      collect: satisfacaoCollectNode,
      tool_loop: satisfacaoToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "collect", to: "terminal" },
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "parse",
        router: routeAfterSatisfacaoParse,
        mapping: { collect: "collect", tool_loop: "tool_loop" },
      },
    ],
  });

  return compiled;
}

export function resetSatisfacaoGraphForTests(): void {
  compiled = null;
}
