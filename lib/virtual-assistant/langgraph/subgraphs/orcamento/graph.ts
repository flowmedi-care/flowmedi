import { compileStageGraph } from "../build-stage-graph";
import {
  orcamentoResolveNode,
  orcamentoSendNode,
  orcamentoStatusNode,
  orcamentoToolLoopNode,
  routeAfterOrcamentoResolve,
  routeAfterOrcamentoSend,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildOrcamentoGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "resolve",
    terminals: ["terminal"],
    nodes: {
      resolve: orcamentoResolveNode,
      send: orcamentoSendNode,
      status: orcamentoStatusNode,
      tool_loop: orcamentoToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "status", to: "terminal" },
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "resolve",
        router: routeAfterOrcamentoResolve,
        mapping: { done: "terminal", send: "send", status: "status" },
      },
      {
        from: "send",
        router: routeAfterOrcamentoSend,
        mapping: { done: "terminal", tool_loop: "tool_loop" },
      },
    ],
  });

  return compiled;
}

export function resetOrcamentoGraphForTests(): void {
  compiled = null;
}
