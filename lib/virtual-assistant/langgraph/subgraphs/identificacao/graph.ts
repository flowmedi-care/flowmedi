import { compileStageGraph } from "../build-stage-graph";
import {
  identificacaoJourneyNode,
  identificacaoLookupNode,
  identificacaoToolLoopNode,
  routeAfterIdentificacaoJourney,
  routeAfterIdentificacaoLookup,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildIdentificacaoGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "lookup",
    terminals: ["terminal"],
    nodes: {
      lookup: identificacaoLookupNode,
      journey: identificacaoJourneyNode,
      tool_loop: identificacaoToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "lookup",
        router: routeAfterIdentificacaoLookup,
        mapping: { done: "terminal", journey: "journey" },
      },
      {
        from: "journey",
        router: routeAfterIdentificacaoJourney,
        mapping: { routed: "terminal", tool_loop: "tool_loop" },
      },
    ],
  });

  return compiled;
}

export function resetIdentificacaoGraphForTests(): void {
  compiled = null;
}
