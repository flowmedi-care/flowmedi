import { compileStageGraph } from "../build-stage-graph";
import type { GraphState } from "../../state";
import {
  agendamentoBootstrapNode,
  agendamentoEnsureDataNode,
  agendamentoFallbackNode,
  agendamentoFetchSlotsNode,
  agendamentoMetaNode,
  agendamentoResetNode,
  agendamentoSlotNode,
  agendamentoToolLoopNode,
  routeAfterAgendamentoEnsure,
  routeAfterAgendamentoFallback,
  routeAfterAgendamentoFetch,
  routeAfterAgendamentoMeta,
  routeAfterAgendamentoSlot,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildAgendamentoGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "reset",
    terminals: ["terminal"],
    nodes: {
      reset: agendamentoResetNode,
      meta: agendamentoMetaNode,
      bootstrap: agendamentoBootstrapNode,
      slot: agendamentoSlotNode,
      ensure: agendamentoEnsureDataNode,
      fetch: agendamentoFetchSlotsNode,
      fallback: agendamentoFallbackNode,
      tool_loop: agendamentoToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "reset", to: "meta" },
      { from: "bootstrap", to: "slot" },
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "meta",
        router: routeAfterAgendamentoMeta,
        mapping: { done: "terminal", continue: "bootstrap" },
      },
      {
        from: "slot",
        router: routeAfterAgendamentoSlot,
        mapping: { done: "terminal", continue: "ensure" },
      },
      {
        from: "ensure",
        router: routeAfterAgendamentoEnsure,
        mapping: { done: "terminal", fetch: "fetch" },
      },
      {
        from: "fetch",
        router: routeAfterAgendamentoFetch,
        mapping: { done: "terminal", fallback: "fallback" },
      },
      {
        from: "fallback",
        router: routeAfterAgendamentoFallback,
        mapping: { done: "terminal", tool_loop: "tool_loop" },
      },
    ],
  });

  return compiled;
}

export async function runAgendamentoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  const graph = buildAgendamentoGraph();
  const result = await graph.invoke(state);
  return result as Partial<GraphState>;
}

export function resetAgendamentoGraphForTests(): void {
  compiled = null;
}
