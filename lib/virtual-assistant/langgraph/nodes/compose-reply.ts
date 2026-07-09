import { buildToolRoundLimitFallback } from "../../format-ai-state";
import { composeSystemPrompt } from "../../prompt/prompt-compose";
import { createChatCompletion } from "../../openai-client";
import { applyReplyGuards } from "../../reply-guards";
import type { GraphState } from "../state";
import { logLangGraphTrace } from "../trace";
import type { InboundIntent } from "../../detect-inbound-intent";

const DETERMINISTIC_COMPOSE_INTENTS = new Set<InboundIntent>([
  "greeting",
  "booking",
  "availability_check",
]);

export async function composeReplyNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const hadReplyBeforeCompose = Boolean(state.reply?.trim());

  if (state.reply?.trim()) {
    logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
      node: "compose_reply",
      detected_intent: state.detectedIntent,
      pipeline_stage: state.pipelineStage,
      reply_source: state.replySource ?? "subgraph",
      had_reply_before_compose: true,
      compose_invoked: false,
      compose_skipped: true,
      reply_preview: state.reply.slice(0, 120),
    });
    return {
      reply: applyReplyGuards(state.reply, state.aiState),
      hadReplyBeforeCompose: true,
    };
  }

  if (DETERMINISTIC_COMPOSE_INTENTS.has(state.detectedIntent)) {
    const fallback = buildToolRoundLimitFallback({
      ...state.aiState,
      intent: state.detectedIntent === "greeting" ? state.aiState.intent : "booking",
      pipeline_stage: state.pipelineStage,
    });
    logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
      node: "compose_reply",
      detected_intent: state.detectedIntent,
      pipeline_stage: state.pipelineStage,
      reply_source: "fallback",
      had_reply_before_compose: false,
      compose_invoked: false,
      compose_skipped: true,
      reply_preview: fallback.slice(0, 120),
    });
    return {
      reply: applyReplyGuards(fallback, state.aiState),
      replySource: "fallback",
      hadReplyBeforeCompose: false,
    };
  }

  const assistantName = ctx.settings.assistant_name ?? "assistente virtual";
  const clinicName = "sua clínica";

  const systemContent = composeSystemPrompt({
    clinicName,
    assistantName,
    settings: ctx.settings,
    clinicData: state.clinicDataText,
    flow: state.routedFlow,
    aiState: state.aiState,
    journeyBlock: state.journeyBlock || undefined,
    whatsappPhone: ctx.phoneNumber,
    patientBootstrap: state.patientBootstrap || undefined,
    pipelineBlock: `Pipeline do agente (etapa atual): ${state.pipelineStage}${
      state.parallelStages.length ? ` (+ paralelo: ${state.parallelStages.join(", ")})` : ""
    }.`,
  });

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemContent },
  ];
  for (const h of state.history.slice(-(ctx.settings.max_context_messages ?? 20))) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: state.inboundText });

  const completion = await createChatCompletion({
    model: ctx.settings.ai_model ?? "gpt-4o-mini",
    messages,
    temperature: 0.3,
    maxTokens: 500,
  });

  const reply =
    completion.content?.trim() ||
    "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?";

  logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
    node: "compose_reply",
    detected_intent: state.detectedIntent,
    pipeline_stage: state.pipelineStage,
    reply_source: "compose_llm",
    had_reply_before_compose: hadReplyBeforeCompose,
    compose_invoked: true,
    compose_skipped: false,
    reply_preview: reply.slice(0, 120),
  });

  return {
    reply: applyReplyGuards(reply, state.aiState),
    replySource: "compose_llm",
    hadReplyBeforeCompose,
  };
}
