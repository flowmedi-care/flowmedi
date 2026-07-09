import {
  extractToolExecutionModesFromSettings,
  filterToolsForStage,
  patchStateFromToolResult,
  validateToolExecution,
  incrementToolFailureCount,
  resetToolFailureCount,
  MAX_CONSECUTIVE_TOOL_FAILURES,
} from "../../agent-pipeline";
import { createChatCompletion, logTokenUsage } from "../../openai-client";
import { executeAssistantTool } from "../../tools";
import { isActiveBookingState } from "@/lib/operational-agents/booking-executor";
import { applyReplyGuards } from "../../reply-guards";
import {
  bookingGuidanceReply,
  shouldBlockBookingToolLoop,
} from "../../booking-state/booking-action-table";
import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import type { GraphState } from "../state";
import { buildPendingConfirmation } from "../nodes/human-confirm";
import type { AiConversationState } from "../../types";

const MAX_TOOL_ROUNDS_DEFAULT = 3;
const MAX_TOOL_ROUNDS_BOOKING = 3;

function resolveMaxToolRounds(state: AiConversationState): number {
  if (state.intent === "booking" || state.booking_step || state.pending_confirmation_appointment_id) {
    return MAX_TOOL_ROUNDS_BOOKING;
  }
  return MAX_TOOL_ROUNDS_DEFAULT;
}

function extractConfirmationFromToolResults(
  messages: { role: string; content: string | null; name?: string }[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "tool" || m.name !== "create_appointment") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}") as { confirmation_message?: string };
      if (parsed.confirmation_message) return parsed.confirmation_message;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function extractSlotsDisplayFromToolResults(
  messages: { role: string; content: string | null; name?: string }[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "tool" || m.name !== "find_available_slots") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}") as {
        display_message?: string | null;
        error?: string;
      };
      if (parsed.error) continue;
      if (parsed.display_message) return parsed.display_message;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function runStageToolLoop(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  if (shouldBlockBookingToolLoop(state.aiState)) {
    return {
      aiState: state.aiState,
      reply: applyReplyGuards(
        bookingGuidanceReply(
          "Para confirmar o horário, responda com o número ou horário da lista que enviei."
        ),
        state.aiState
      ),
      stageSubgraphComplete: true,
      needsToolLoop: false,
    };
  }

  const tools = filterToolsForStage({
    mainStage: state.pipelineStage,
    parallelStages: state.parallelStages,
    includeFinanceRead:
      state.detectedIntent === "payment" || state.aiState.intent === "payment",
  });

  const assistantName = ctx.settings.assistant_name ?? "assistente virtual";
  const systemContent = [
    `Você é ${assistantName} da clínica.`,
    `Etapa: ${state.pipelineStage}. Use APENAS as ferramentas desta etapa.`,
    "Responda em português brasileiro, de forma objetiva.",
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
  const maxRounds = resolveMaxToolRounds(aiState);

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

      if (
        tc.function.name === "transfer_to_human" &&
        (state.pipelineStage === "agendamento" || isActiveBookingState(aiState))
      ) {
        messages.push({
          role: "tool",
          content: JSON.stringify({
            error: "Transferência bloqueada durante agendamento ativo.",
            hint: "Continue com find_available_slots ou create_appointment.",
          }),
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
      const toolFailed = Boolean(parsed.error);
      aiState = {
        ...aiState,
        ...toolResult.statePatch,
        ...resultPatch,
        ...(toolFailed
          ? incrementToolFailureCount(aiState)
          : resetToolFailureCount()),
      };

      if (
        toolFailed &&
        (aiState.consecutive_tool_failures ?? 0) >= MAX_CONSECUTIVE_TOOL_FAILURES &&
        ctx.settings.human_handoff_enabled !== false
      ) {
        const handoffResult = await executeAssistantTool(
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
        if (handoffResult.handoff) {
          return {
            aiState,
            handoff: true,
            reply: HANDOFF_REPLY_BODY,
            stageSubgraphComplete: true,
          };
        }
      }

      if (toolResult.handoff) {
        return {
          aiState,
          handoff: true,
          reply: HANDOFF_REPLY_BODY,
          stageSubgraphComplete: true,
        };
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

    const confirmationMsg = extractConfirmationFromToolResults(messages);
    if (confirmationMsg) {
      return {
        aiState,
        reply: applyReplyGuards(confirmationMsg, aiState),
        stageSubgraphComplete: true,
        needsToolLoop: false,
      };
    }

    const slotsDisplay = extractSlotsDisplayFromToolResults(messages);
    if (slotsDisplay) {
      return {
        aiState: { ...aiState, last_display_message: slotsDisplay },
        reply: applyReplyGuards(slotsDisplay, aiState),
        stageSubgraphComplete: true,
        needsToolLoop: false,
      };
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
