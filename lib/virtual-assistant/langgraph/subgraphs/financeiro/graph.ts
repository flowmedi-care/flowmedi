import { compileStageGraph } from "../build-stage-graph";
import { financeiroStatusNode } from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildFinanceiroGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "status",
    terminals: ["terminal"],
    nodes: {
      status: financeiroStatusNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [{ from: "status", to: "terminal" }],
  });

  return compiled;
}

export function resetFinanceiroGraphForTests(): void {
  compiled = null;
}
