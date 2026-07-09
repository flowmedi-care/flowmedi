import { compileStageGraph } from "../build-stage-graph";
import {
  confirmacaoActionNode,
  confirmacaoLoadNode,
  confirmacaoParseNode,
  confirmacaoToolLoopNode,
  routeAfterConfirmacaoParse,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildConfirmacaoGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "load",
    terminals: ["terminal"],
    nodes: {
      load: confirmacaoLoadNode,
      parse: confirmacaoParseNode,
      action: confirmacaoActionNode,
      tool_loop: confirmacaoToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "load", to: "parse" },
      { from: "action", to: "terminal" },
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "parse",
        router: routeAfterConfirmacaoParse,
        mapping: { tool_loop: "tool_loop", action: "action" },
      },
    ],
  });

  return compiled;
}

export function resetConfirmacaoGraphForTests(): void {
  compiled = null;
}
