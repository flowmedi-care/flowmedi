import { END, START, StateGraph } from "@langchain/langgraph";
import { getCheckpointer } from "../langgraph/checkpointer";
import { loadContextNode } from "../langgraph/nodes/load-context";
import { GraphStateAnnotation } from "../langgraph/state";
import { simpleEscalateGateNode, shouldSimpleEscalateAfterGate } from "./nodes/escalate-gate";
import { simpleExecuteNode } from "./nodes/execute";
import { simpleRouterNode } from "./nodes/router";
import { simpleSyncStateNode } from "./nodes/sync-state";

let compiledGraph: Awaited<ReturnType<typeof buildSimpleAssistantGraph>> | null = null;

export async function buildSimpleAssistantGraph() {
  const checkpointer = await getCheckpointer();

  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("load_context", loadContextNode)
    .addNode("router", simpleRouterNode)
    .addNode("escalate_gate", simpleEscalateGateNode)
    .addNode("execute", simpleExecuteNode)
    .addNode("sync_state", simpleSyncStateNode)
    .addEdge(START, "load_context")
    .addEdge("load_context", "router")
    .addEdge("router", "escalate_gate")
    .addConditionalEdges("escalate_gate", shouldSimpleEscalateAfterGate, {
      handoff: "sync_state",
      continue: "execute",
    })
    .addEdge("execute", "sync_state")
    .addEdge("sync_state", END);

  return graph.compile({ checkpointer });
}

export async function getSimpleAssistantGraph() {
  if (!compiledGraph) {
    compiledGraph = await buildSimpleAssistantGraph();
  }
  return compiledGraph;
}

export function resetSimpleAssistantGraphForTests(): void {
  compiledGraph = null;
}
