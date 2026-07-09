import { END, START, StateGraph } from "@langchain/langgraph";
import { getCheckpointer } from "./checkpointer";
import { classifyIntentNode } from "./nodes/classify-intent";
import { bookingContinuityNode, routeAfterBookingContinuity } from "./nodes/booking-continuity";
import { composeReplyNode } from "./nodes/compose-reply";
import { escalateGateNode, shouldEscalateAfterGate } from "./nodes/escalate-gate";
import { handoffNode } from "./nodes/handoff";
import { humanConfirmNode, checkPendingHumanConfirm } from "./nodes/human-confirm";
import { loadContextNode } from "./nodes/load-context";
import { resolveStageNode } from "./nodes/resolve-stage";
import { routeAfterStage, stageRouterNode } from "./nodes/stage-router";
import { syncStateNode } from "./nodes/sync-state";
import { GraphStateAnnotation } from "./state";
import { runStageToolLoop } from "./tools/tool-node";

let compiledGraph: Awaited<ReturnType<typeof buildAssistantGraph>> | null = null;

export async function buildAssistantGraph() {
  const checkpointer = await getCheckpointer();

  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("load_context", loadContextNode)
    .addNode("classify_intent", classifyIntentNode)
    .addNode("booking_continuity", bookingContinuityNode)
    .addNode("escalate_gate", escalateGateNode)
    .addNode("resolve_stage", resolveStageNode)
    .addNode("human_confirm", humanConfirmNode)
    .addNode("stage_router", stageRouterNode)
    .addNode("stage_tool_loop", runStageToolLoop)
    .addNode("compose_reply", composeReplyNode)
    .addNode("execute_handoff", handoffNode)
    .addNode("sync_state", syncStateNode)
    .addEdge(START, "load_context")
    .addEdge("load_context", "classify_intent")
    .addConditionalEdges("classify_intent", checkPendingHumanConfirm, {
      confirm: "human_confirm",
      skip: "booking_continuity",
    })
    .addConditionalEdges("booking_continuity", routeAfterBookingContinuity, {
      handled: "compose_reply",
      continue: "escalate_gate",
    })
    .addConditionalEdges("escalate_gate", shouldEscalateAfterGate, {
      handoff: "execute_handoff",
      continue: "resolve_stage",
    })
    .addEdge("resolve_stage", "stage_router")
    .addConditionalEdges("stage_router", routeAfterStage, {
      compose: "compose_reply",
      confirm: "human_confirm",
      tool_loop: "stage_tool_loop",
      handoff: "execute_handoff",
    })
    .addConditionalEdges("stage_tool_loop", routeAfterStage, {
      compose: "compose_reply",
      confirm: "human_confirm",
      tool_loop: "stage_tool_loop",
      handoff: "execute_handoff",
    })
    .addConditionalEdges("human_confirm", (state) =>
      state.needsToolLoop ? "tool_loop" : "compose"
    , {
      tool_loop: "stage_tool_loop",
      compose: "compose_reply",
    })
    .addEdge("compose_reply", "sync_state")
    .addEdge("execute_handoff", "sync_state")
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
