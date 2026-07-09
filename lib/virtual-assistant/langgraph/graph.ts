import { END, START, StateGraph } from "@langchain/langgraph";
import { getCheckpointer } from "./checkpointer";
import { classifyIntentNode } from "./nodes/classify-intent";
import { composeReplyNode } from "./nodes/compose-reply";
import { escalateGateNode, shouldEscalateAfterGate } from "./nodes/escalate-gate";
import { loadContextNode } from "./nodes/load-context";
import { routeAndExecuteNode } from "./nodes/route-and-execute";
import { syncStateNode } from "./nodes/sync-state";
import { GraphStateAnnotation } from "./state";

let compiledGraph: Awaited<ReturnType<typeof buildAssistantGraph>> | null = null;

export async function buildAssistantGraph() {
  const checkpointer = await getCheckpointer();

  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("load_context", loadContextNode)
    .addNode("classify_intent", classifyIntentNode)
    .addNode("escalate_gate", escalateGateNode)
    .addNode("route_and_execute", routeAndExecuteNode)
    .addNode("compose_reply", composeReplyNode)
    .addNode("sync_state", syncStateNode)
    .addEdge(START, "load_context")
    .addEdge("load_context", "classify_intent")
    .addEdge("classify_intent", "escalate_gate")
    .addConditionalEdges("escalate_gate", shouldEscalateAfterGate, {
      handoff: "sync_state",
      continue: "route_and_execute",
    })
    .addEdge("route_and_execute", "compose_reply")
    .addEdge("compose_reply", "sync_state")
    .addEdge("sync_state", END);

  return graph.compile({ checkpointer });
}

export async function getAssistantGraph() {
  if (!compiledGraph) {
    compiledGraph = await buildAssistantGraph();
  }
  return compiledGraph;
}

export function resetAssistantGraphForTests(): void {
  compiledGraph = null;
}
