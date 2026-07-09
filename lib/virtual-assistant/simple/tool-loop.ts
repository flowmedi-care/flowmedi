import type { ToolDefinition } from "../openai-client";
import {
  extractToolExecutionModesFromSettings,
  patchStateFromToolResult,
  validateToolExecution,
  incrementToolFailureCount,
  resetToolFailureCount,
  MAX_CONSECUTIVE_TOOL_FAILURES,
} from "../agent-pipeline";
import { createChatCompletion, logTokenUsage } from "../openai-client";
import { executeAssistantTool } from "../tools";
import { applyReplyGuards } from "../reply-guards";
import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import type { GraphState } from "../langgraph/state";
import { buildPendingConfirmation } from "../langgraph/nodes/human-confirm";
import type { AgentPipelineStage } from "../agent-pipeline/stages";

const MAX_ROUNDS = 3;

export async function runSimpleToolLoop(
  state: GraphState,
  opts: {
    tools: ToolDefinition[];
    pipelineStage: AgentPipelineStage;
    systemHint?: string;
  }
): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const assistantName = ctx.settings.assistant_name ?? "assistente virtual";
  const systemContent = [
    `Você é ${assistantName} da clínica, atendendo via WhatsApp.`,
    opts.systemHint ?? "Responda de forma objetiva em português brasileiro.",
    "Use ferramentas quando precisar de dados da clínica. Nunca invente valores ou horários.",
  ].join("\n");

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

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const completion = await createChatCompletion({
      model: ctx.settings.ai_model ?? "gpt-4o-mini",
      messages,
      tools: opts.tools,
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
        pipelineStage: opts.pipelineStage,
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
        opts.pipelineStage
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

      const pending = buildPendingConfirmation(
        { ...state, pipelineStage: opts.pipelineStage },
        tc.function.name,
        args
      );
      if (pending) {
        return {
          aiState: { ...aiState, pending_tool_confirmation: pending },
          reply: pending.prompt_message ?? "Confirma esta ação? Responda sim ou não.",
          needsHumanConfirm: true,
          stageSubgraphComplete: true,
          pipelineStage: opts.pipelineStage,
        };
      }

      const toolResult = await executeAssistantTool(
        {
          supabase: ctx.supabase,
          clinicId: ctx.clinicId,
          conversationId: ctx.conversationId,
          phoneNumber: ctx.phoneNumber,
          aiState,
          pipelineStage: opts.pipelineStage,
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
      const toolFailed = Boolean(parsed.error);
      aiState = {
        ...aiState,
        ...toolResult.statePatch,
        ...resultPatch,
        ...(toolFailed ? incrementToolFailureCount(aiState) : resetToolFailureCount()),
      };

      if (
        toolFailed &&
        (aiState.consecutive_tool_failures ?? 0) >= MAX_CONSECUTIVE_TOOL_FAILURES &&
        ctx.settings.human_handoff_enabled !== false
      ) {
        await executeAssistantTool(
          {
            supabase: ctx.supabase,
            clinicId: ctx.clinicId,
            conversationId: ctx.conversationId,
            phoneNumber: ctx.phoneNumber,
            aiState,
            skipPipelineValidation: true,
          },
          "transfer_to_human",
          { reason: "repeated_tool_failures" }
        );
        return {
          aiState,
          handoff: true,
          reply: HANDOFF_REPLY_BODY,
          stageSubgraphComplete: true,
          pipelineStage: opts.pipelineStage,
        };
      }

      messages.push({
        role: "tool",
        content: toolResult.result,
        tool_call_id: tc.id,
        name: tc.function.name,
      });

      if (toolResult.handoff) {
        return {
          aiState,
          handoff: true,
          reply: HANDOFF_REPLY_BODY,
          stageSubgraphComplete: true,
          pipelineStage: opts.pipelineStage,
        };
      }
    }
  }

  return {
    aiState,
    reply: applyReplyGuards(
      "Preciso de mais um detalhe para continuar. Pode reformular?",
      aiState
    ),
    stageSubgraphComplete: true,
    pipelineStage: opts.pipelineStage,
  };
}
