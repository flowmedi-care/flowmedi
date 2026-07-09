import { compileStageGraph } from "../build-stage-graph";
import {
  captacaoDiscoveryNode,
  captacaoRouteNode,
  routeAfterCaptacaoRoute,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildCaptacaoGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "route",
    terminals: ["terminal"],
    nodes: {
      route: captacaoRouteNode,
      discovery: captacaoDiscoveryNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "discovery", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "route",
        router: routeAfterCaptacaoRoute,
        mapping: { done: "terminal", discovery: "discovery" },
      },
    ],
  });

  return compiled;
}

export function resetCaptacaoGraphForTests(): void {
  compiled = null;
}
