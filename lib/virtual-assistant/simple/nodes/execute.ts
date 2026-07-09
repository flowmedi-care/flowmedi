import {
  handleAgentFallback,
  handleBooking,
  handleDiscovery,
  handleGreeting,
  handleHandoff,
  handlePricing,
} from "../handlers";
import type { GraphState } from "../../langgraph/state";
import { logLangGraphTrace } from "../../langgraph/trace";
import { composeReplyNode } from "../../langgraph/nodes/compose-reply";

export async function simpleExecuteNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  if (state.handoff && state.reply?.trim()) {
    return { stageSubgraphComplete: true, replySource: "deterministic" };
  }

  let result: Partial<GraphState>;

  switch (state.assistantRoute) {
    case "greeting":
      result = await handleGreeting(state);
      break;
    case "discovery":
      result = await handleDiscovery(state);
      break;
    case "pricing":
      result = await handlePricing(state);
      break;
    case "booking":
      result = await handleBooking(state);
      break;
    case "handoff":
      result = await handleHandoff(state);
      break;
    case "agent":
    default:
      result = await handleAgentFallback(state);
      break;
  }

  if (ctx) {
    logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
      node: "simple_execute",
      detected_intent: state.detectedIntent,
      routed_flow: state.assistantRoute,
      reply_source: result.replySource ?? undefined,
      reply_preview: result.reply?.slice(0, 120),
    });
  }

  const merged = { ...state, ...result };
  if (result.reply?.trim()) {
    return result;
  }

  return composeReplyNode(merged);
}
