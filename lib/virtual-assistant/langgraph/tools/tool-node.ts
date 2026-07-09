import {
  extractToolExecutionModesFromSettings,
  filterToolsForStage,
  patchStateFromToolResult,
  validateToolExecution,
} from "../../agent-pipeline";
import { composeSystemPrompt } from "../../prompt/prompt-compose";
import { createChatCompletion, logTokenUsage } from "../../openai-client";
import { executeAssistantTool } from "../../tools";
import { applyReplyGuards } from "../../reply-guards";
import type { GraphState } from "../state";
import { buildPendingConfirmation } from "../nodes/human-confirm";

export async function runStageToolLoop(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const tools = filterToolsForStage({
    mainStage: state.pipelineStage,
    parallelStages: state.parallelStages,
    includeFinanceRead:
      state.detectedIntent === "payment" || state.aiState.intent === "payment",
  });

  const assistantName = ctx.settings.assistant_name ?? "assistente virtual";
  const systemContent = composeSystemPrompt({
    clinicName: "sua clínica",
    assistantName,
    settings: ctx.settings,
    clinicData: state.clinicDataText,
    flow: state.routedFlow,
    aiState: state.aiState,
    journeyBlock: state.journeyBlock || undefined,
    whatsappPhone: ctx.phoneNumber,
    patientBootstrap: state.patientBootstrap || undefined,
    pipelineBlock: `Etapa: ${state.pipelineStage}. Use APENAS as ferramentas desta etapa.`,
  });

  const messages: {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_call_id?: string;
    name?: string;
    tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  }[] = [{ role: "system", content: systemContent }];

  for (const h of state.history.slice(-(ctx.settings.max_context_messages ?? 20))) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: state.inboundText });

  let aiState = { ...state.aiState };
  const toolModes = extractToolExecutionModesFromSettings(ctx.settings);
  const maxRounds = 5;

  for (let round = 0; round < maxRounds; round++) {
    const completion = await createChatCompletion({
      model: ctx.settings.ai_model ?? "gpt-4o-mini",
      messages,
      tools,
      temperature: 0.2,
    });
    logTokenUsage(ctx.clinicId, completion.usage);

    if (!completion.tool_calls?.length) {
      const reply =
        completion.content?.trim() ||
        "Preciso de mais um detalhe para continuar. Pode me explicar melhor?";
      return {
        aiState,
        reply: applyReplyGuards(reply, aiState),
        stageSubgraphComplete: true,
        needsToolLoop: false,
      };
    }

    messages.push({
      role: "assistant",
      content: completion.content ?? null,
      tool_calls: completion.tool_calls,
    });

    for (const tc of completion.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }

      const validation = validateToolExecution(
        tc.function.name,
        args,
        aiState,
        state.pipelineStage
      );
      if (!validation.ok) {
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: validation.error, hint: validation.hint }),
          tool_call_id: tc.id,
          name: tc.function.name,
        });
        continue;
      }

      const pending = buildPendingConfirmation(state, tc.function.name, args);
      if (pending) {
        return {
          aiState: { ...aiState, pending_tool_confirmation: pending },
          reply: pending.prompt_message ?? "Confirma esta ação? Responda sim ou não.",
          needsHumanConfirm: true,
          stageSubgraphComplete: true,
        };
      }

      const toolResult = await executeAssistantTool(
        {
          supabase: ctx.supabase,
          clinicId: ctx.clinicId,
          conversationId: ctx.conversationId,
          phoneNumber: ctx.phoneNumber,
          aiState,
          pipelineStage: state.pipelineStage,
          parallelStages: state.parallelStages,
          toolExecutionModes: toolModes,
        },
        tc.function.name,
        args
      );

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(toolResult.result) as Record<string, unknown>;
      } catch {
        parsed = {};
      }

      const resultPatch = patchStateFromToolResult(tc.function.name, args, parsed, aiState);
      aiState = {
        ...aiState,
        ...toolResult.statePatch,
        ...resultPatch,
      };

      if (toolResult.handoff) {
        return { aiState, handoff: true, stageSubgraphComplete: true };
      }

      if (parsed.display_message && typeof parsed.display_message === "string") {
        return {
          aiState,
          reply: applyReplyGuards(parsed.display_message, aiState),
          stageSubgraphComplete: true,
        };
      }

      messages.push({
        role: "tool",
        content: toolResult.result,
        tool_call_id: tc.id,
        name: tc.function.name,
      });
    }
  }

  return {
    aiState,
    needsToolLoop: false,
    stageSubgraphComplete: true,
    reply: applyReplyGuards(
      "Preciso de mais um detalhe para continuar. O que você precisa?",
      aiState
    ),
  };
}
