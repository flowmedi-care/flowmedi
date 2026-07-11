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
import {
  filterToolsByNames,
  syncFlowState,
} from "@/lib/attendance-flow/engine";
import {
  mergeClinicFlowConfig,
  syncConversationFlowTurn,
  type ClinicFlowConfig,
} from "@/lib/attendance-flow/flow-sync";
import type { CustomFieldForGoals } from "@/lib/attendance-flow/types";

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
  flowConfig?: ClinicFlowConfig;
  customFields?: CustomFieldForGoals[];
};

export type RunTurnResult = {
  reply: string;
  handoff?: boolean;
  statePatch: Record<string, unknown>;
};

function reapplyFlowSync(
  aiState: AiState,
  userText: string,
  flowConfig: ClinicFlowConfig,
  customFields?: CustomFieldForGoals[]
) {
  const sync = syncConversationFlowTurn(aiState, userText, flowConfig, customFields);
  const merged = mergeAiState(aiState, sync.aiStatePatch);
  const engineInput = { ...sync.engineInput, aiState: merged };
  const synced = syncFlowState(engineInput);
  return {
    aiState: mergeAiState(merged, { conversation_flow: synced }),
    flowBlock: sync.flowBlock,
    allowedTools: sync.allowedTools,
    engineInput: { ...engineInput, flowState: synced, aiState: mergeAiState(merged, { conversation_flow: synced }) },
  };
}

export async function runTurn(input: RunTurnInput): Promise<RunTurnResult> {
  let aiState: AiState = normalizeAiState(input.aiState);
  const trace = createTurnTrace(input.conversationId, input.userText);

  const flowConfig =
    input.flowConfig ??
    mergeClinicFlowConfig({
      appointment_policy: input.settings.appointment_policy as ClinicFlowConfig["appointmentPolicy"],
      conversation_flows: input.settings.conversation_flows as ClinicFlowConfig["conversationFlows"],
    });

  const facts = extractFacts(input.userText);
  trace.extractorsApplied = facts;
  const factPatch = resolveReferenceFacts(facts, aiState);
  if (Object.keys(factPatch).length > 0) {
    aiState = mergeAiState(aiState, factPatch);
  }

  let flowSync = reapplyFlowSync(aiState, input.userText, flowConfig, input.customFields);
  aiState = flowSync.aiState;

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
    flowBlock: flowSync.flowBlock,
  });

  const messages: ChatMessage[] = [{ role: "system", content: systemContent }];
  const filteredTools = filterToolsByNames(CHATBOT_TOOLS, flowSync.allowedTools);

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
      tools: filteredTools.length ? filteredTools : CHATBOT_TOOLS,
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
      const validation = validateToolCall(
        toolName,
        args,
        aiState,
        input.settings,
        facts,
        flowSync.engineInput
      );
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
            flowConfig,
            customFields: input.customFields,
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

      flowSync = reapplyFlowSync(aiState, input.userText, flowConfig, input.customFields);
      aiState = flowSync.aiState;

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
          flowConfig,
          customFields: input.customFields,
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
