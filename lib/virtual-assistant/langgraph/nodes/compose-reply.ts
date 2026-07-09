import { composeSystemPrompt } from "../../prompt/prompt-compose";
import { createChatCompletion } from "../../openai-client";
import { applyReplyGuards } from "../../reply-guards";
import type { GraphState } from "../state";

export async function composeReplyNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  if (state.reply?.trim()) {
    return {
      reply: applyReplyGuards(state.reply, state.aiState),
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

  return {
    reply: applyReplyGuards(reply, state.aiState),
  };
}
