import { applyReplyGuards } from "../../reply-guards";
import type { GraphState } from "../state";
import { CAPTACAO_GREETING_MENU, logLangGraphTrace } from "../trace";

export async function deterministicRouterNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;

  if (state.reply?.trim()) {
    if (ctx) {
      logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
        node: "deterministic_router",
        detected_intent: state.detectedIntent,
        pipeline_stage: state.pipelineStage,
        reply_source: state.replySource ?? "subgraph",
        reply_preview: state.reply.slice(0, 120),
        compose_skipped: true,
      });
    }
    return {};
  }

  if (state.detectedIntent === "greeting") {
    const reply = applyReplyGuards(CAPTACAO_GREETING_MENU, state.aiState);
    if (ctx) {
      logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
        node: "deterministic_router",
        detected_intent: "greeting",
        pipeline_stage: state.pipelineStage ?? "captacao",
        reply_source: "deterministic",
        reply_preview: reply.slice(0, 120),
        compose_skipped: true,
      });
    }
    return {
      reply,
      replySource: "deterministic",
      pipelineStage: "captacao",
      aiState: {
        ...state.aiState,
        pipeline_stage: "captacao",
      },
      stageSubgraphComplete: true,
    };
  }

  if (ctx) {
    logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
      node: "deterministic_router",
      detected_intent: state.detectedIntent,
      pipeline_stage: state.pipelineStage,
      compose_skipped: false,
      inbound_preview: state.inboundText.slice(0, 80),
    });
  }

  return {};
}

export function routeAfterDeterministicRouter(state: GraphState): "compose" | "stage_router" {
  if (state.reply?.trim()) return "compose";
  return "stage_router";
}
