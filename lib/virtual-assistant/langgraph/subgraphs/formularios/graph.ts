import { compileStageGraph } from "../build-stage-graph";
import {
  formulariosResendNode,
  formulariosStatusNode,
  formulariosToolLoopNode,
  routeAfterFormulariosStatus,
} from "./nodes";

let compiled: ReturnType<typeof compileStageGraph> | null = null;

export function buildFormulariosGraph() {
  if (compiled) return compiled;

  compiled = compileStageGraph({
    entry: "status",
    terminals: ["terminal"],
    nodes: {
      status: formulariosStatusNode,
      resend: formulariosResendNode,
      tool_loop: formulariosToolLoopNode,
      terminal: async () => ({ stageSubgraphComplete: true }),
    },
    edges: [
      { from: "resend", to: "terminal" },
      { from: "tool_loop", to: "terminal" },
    ],
    conditionalEdges: [
      {
        from: "status",
        router: routeAfterFormulariosStatus,
        mapping: { done: "terminal", resend: "resend", tool_loop: "tool_loop" },
      },
    ],
  });

  return compiled;
}

export function resetFormulariosGraphForTests(): void {
  compiled = null;
}
