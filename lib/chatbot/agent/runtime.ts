import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { extractFacts } from "../extractors";
import { applyReplyGuards } from "../guardrails/reply-guards";
import { shouldEscalateOnToolFailures } from "../guardrails/handoff";
import { validateToolCall } from "../guardrails/validators";
import { createTurnTrace, logTurnTrace } from "../observability/turn-trace";
import { mergeAiState, patchAiState } from "../state/patch";
import { resolveReferenceFacts } from "../state/resolve-facts";
import { buildChatbotFallbackReply } from "../state/format-for-prompt";
import { normalizeAiState, serializeAiState } from "../state/migrate";
import type { AiState } from "../state/types";
import { CHATBOT_TOOLS } from "../tools/definitions";
import { executeTool } from "../tools/execute";
import type { FaqItem } from "../tools/types";
import { toolResultToJson } from "../tools/types";
import { buildSystemPrompt } from "./prompt";
import { createChatCompletion, logTokenUsage, type ChatMessage } from "./llm";

const MAX_TOOL_ROUNDS = 5;

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RunTurnInput = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userText: string;
  history: HistoryMessage[];
  aiState: Record<string, unknown>;
  settings: Partial<VirtualAssistantSettings>;
  faqs: FaqItem[];
  clinicName?: string;
  hoursText?: string;
  address?: string;
};

export type RunTurnResult = {
  reply: string;
  handoff?: boolean;
  statePatch: Record<string, unknown>;
};

export async function runTurn(input: RunTurnInput): Promise<RunTurnResult> {
  let aiState: AiState = normalizeAiState(input.aiState);
  const trace = createTurnTrace(input.conversationId, input.userText);

  const facts = extractFacts(input.userText);
  trace.extractorsApplied = facts;
  const factPatch = resolveReferenceFacts(facts, aiState);
  if (Object.keys(factPatch).length > 0) {
    aiState = mergeAiState(aiState, factPatch);
  }

  const systemContent = buildSystemPrompt({
    clinicName: input.clinicName ?? "clínica",
    assistantName: input.settings.assistant_name ?? "assistente virtual",
    tone: input.settings.tone ?? "informal",
    useEmojis: input.settings.use_emojis ?? true,
    hoursText: input.hoursText,
    address: input.address,
    faqs: input.faqs,
    settings: input.settings,
    aiState,
    facts,
  });

  const messages: ChatMessage[] = [{ role: "system", content: systemContent }];

  const maxContext = input.settings.max_context_messages ?? 20;
  for (const h of input.history.slice(-maxContext)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: input.userText });

  let handoff = false;
  let finalReply: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    trace.llmRounds = round + 1;
    const completion = await createChatCompletion({
      model: input.settings.ai_model ?? "gpt-4o-mini",
      messages,
      tools: CHATBOT_TOOLS,
      temperature: 0.2,
    });

    logTokenUsage(input.clinicId, completion.usage);

    if (!completion.tool_calls?.length) {
      finalReply =
        completion.content?.trim() || buildChatbotFallbackReply(aiState);
      break;
    }

    messages.push({
      role: "assistant",
      content: completion.content ?? null,
      tool_calls: completion.tool_calls,
    });

    for (const call of completion.tool_calls) {
      const toolName = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      const started = Date.now();
      const validation = validateToolCall(toolName, args, aiState, input.settings, facts);
      let outcome;
      let blocked = false;

      if (validation) {
        outcome = { result: validation };
        blocked = true;
      } else {
        outcome = await executeTool(
          {
            supabase: input.supabase,
            clinicId: input.clinicId,
            conversationId: input.conversationId,
            phoneNumber: input.phoneNumber,
            aiState,
            settings: input.settings,
            faqs: input.faqs,
          },
          toolName,
          args
        );
      }

      trace.tools.push({
        toolName,
        round,
        blocked,
        blockReason: blocked ? validation?.message : undefined,
        status: outcome.result.status,
        durationMs: Date.now() - started,
      });

      if (outcome.statePatch) {
        aiState = mergeAiState(aiState, outcome.statePatch);
      }
      aiState = mergeAiState(aiState, patchAiState(toolName, args, outcome.result, aiState));

      if (outcome.handoff) {
        handoff = true;
        trace.handoff = true;
        trace.handoffReason = String(args.reason ?? toolName);
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: toolName,
        content: toolResultToJson(outcome.result),
      });
    }

    if (shouldEscalateOnToolFailures(aiState) && !handoff) {
      const escalation = await executeTool(
        {
          supabase: input.supabase,
          clinicId: input.clinicId,
          conversationId: input.conversationId,
          phoneNumber: input.phoneNumber,
          aiState,
          settings: input.settings,
          faqs: input.faqs,
        },
        "transfer_to_human",
        { reason: "consecutive_tool_failures" }
      );
      if (escalation.handoff) {
        handoff = true;
        trace.handoff = true;
        trace.handoffReason = "consecutive_tool_failures";
        finalReply = "Vou transferir você para nossa equipe para continuar o atendimento.";
        break;
      }
    }
  }

  if (!finalReply) {
    finalReply = buildChatbotFallbackReply(aiState);
  }

  const reply = applyReplyGuards(finalReply, aiState);
  logTurnTrace(trace);

  return {
    reply,
    handoff,
    statePatch: serializeAiState(aiState),
  };
}

export async function runChatbotTurn(input: RunTurnInput): Promise<RunTurnResult> {
  if (!input.userText.trim()) {
    return {
      reply: "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?",
      statePatch: serializeAiState(normalizeAiState(input.aiState)),
    };
  }
  return runTurn(input);
}
