import { resolveAssistantRoute } from "../router";
import type { GraphState } from "../../langgraph/state";
import { logLangGraphTrace } from "../../langgraph/trace";

export async function simpleRouterNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  const { route, aiState } = resolveAssistantRoute({
    inboundText: state.inboundText,
    aiState: state.aiState,
  });

  if (ctx) {
    logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
      node: "simple_router",
      detected_intent: route.intent,
      intent_confidence: route.confidence,
      routed_flow: route.route,
      inbound_preview: state.inboundText.slice(0, 80),
    });
  }

  return {
    assistantRoute: route.route,
    routeSource: route.source,
    detectedIntent: route.intent,
    intentConfidence: route.confidence,
    aiState,
  };
}
