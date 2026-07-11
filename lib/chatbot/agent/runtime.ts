import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { extractFacts } from "../extractors";
import { applyReplyGuards } from "../guardrails/reply-guards";
import { shouldEscalateOnToolFailures } from "../guardrails/handoff";
import { validateToolCall } from "../guardrails/validators";
import {
  appendSnapshotTrace,
  createTurnTrace,
  logTurnTrace,
  sliceSnapshotForTrace,
  type TurnTrace,
} from "../observability/turn-trace";
import type { ExecutionTrace } from "../observability/execution-trace";
import { formatExecutionTrace } from "../observability/execution-trace";
import { mergeAiState, patchAiState, resolveCreateAppointmentScheduledAt } from "../state/patch";
import { resolveReferenceFacts } from "../state/resolve-facts";
import { buildChatbotFallbackReply } from "../state/format-for-prompt";
import { normalizeAiState, serializeAiState } from "../state/migrate";
import type { AiState } from "../state/types";
import { CHATBOT_TOOLS } from "../tools/definitions";
import { executeTool, logBlockedToolCall } from "../tools/execute";
import type { FaqItem } from "../tools/types";
import { toolResultToJson } from "../tools/types";
import { buildSystemPrompt } from "./prompt";
import { createChatCompletion, logTokenUsage, type ChatMessage } from "./llm";
import { canExecuteMutation, filterToolsByNames } from "@/lib/attendance-flow/engine";
import {
  mergeClinicFlowConfig,
  syncConversationFlowTurn,
  type ClinicFlowConfig,
} from "@/lib/attendance-flow/flow-sync";
import type { CustomFieldForGoals } from "@/lib/attendance-flow/types";
import {
  buildConversationSnapshot,
  formatSnapshotForPrompt,
  type ConversationSnapshot,
} from "../conversation-snapshot";
import type { PolicySlice } from "../snapshot/loaders/policy-loader";
import { outcomeFromToolResult } from "../tools/error-class";
import { createTurnContext } from "./turn-context";

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
  patientId?: string | null;
  policySlice?: PolicySlice;
  initialSnapshot?: ConversationSnapshot;
};

export type RunTurnResult = {
  reply: string;
  handoff?: boolean;
  statePatch: Record<string, unknown>;
  trace: TurnTrace;
};

function reapplyFlowSync(
  aiState: AiState,
  userText: string,
  flowConfig: ClinicFlowConfig,
  customFields?: CustomFieldForGoals[],
  patient?: Record<string, unknown> | null,
  turnFacts?: Record<string, unknown>
) {
  const sync = syncConversationFlowTurn(
    aiState,
    userText,
    flowConfig,
    customFields,
    patient,
    turnFacts
  );
  const merged = mergeAiState(aiState, sync.aiStatePatch);
  return {
    aiState: merged,
    flowBlock: sync.flowBlock,
    allowedTools: sync.allowedTools,
    engineInput: { ...sync.engineInput, aiState: merged },
  };
}

function recordSnapshotBuild(
  trace: TurnTrace,
  label: "inbound" | "post_extractors" | "post_mutation",
  snapshot: ConversationSnapshot,
  started: number
): void {
  appendSnapshotTrace(trace, label, snapshot);
  const builtAt = trace.snapshots[trace.snapshots.length - 1]!.snapshotBuiltAt;
  trace.executionTraces.push({
    kind: "snapshot_build",
    name: label,
    outcome: "ok",
    duration_ms: Date.now() - started,
    snapshotBuiltAt: builtAt,
    snapshotAfter: sliceSnapshotForTrace(snapshot) as unknown as Record<string, unknown>,
  });
}

async function rebuildSnapshotAfterMutation(
  input: RunTurnInput,
  aiState: AiState,
  turnFacts: Record<string, unknown>,
  policySlice: PolicySlice,
  trace: TurnTrace
): Promise<ConversationSnapshot> {
  const started = Date.now();
  const snapshot = await buildConversationSnapshot({
    supabase: input.supabase,
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    phoneNumber: input.phoneNumber,
    patientId: aiState.patient_id ?? input.patientId,
    aiState: serializeAiState(aiState),
    turnFacts,
    userText: input.userText,
    policySlice,
  });
  recordSnapshotBuild(trace, "post_mutation", snapshot, started);
  return snapshot;
}

function computeMutationGate(
  flowSync: ReturnType<typeof reapplyFlowSync>
): TurnTrace["mutationGate"] {
  const gate = canExecuteMutation(
    "booking_created",
    flowSync.engineInput.flowState.mode,
    flowSync.engineInput.policy,
    flowSync.engineInput.registry,
    flowSync.engineInput.flowState.pending,
    flowSync.engineInput.workflow.id
  );
  if (gate.ok) return { ok: true };
  return { ok: false, missing: gate.missing, message: gate.message };
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

  const policySlice: PolicySlice =
    input.policySlice ??
    ({
      ...flowConfig,
      customFields: input.customFields ?? [],
    } as PolicySlice);

  const inboundStarted = Date.now();
  let snapshot =
    input.initialSnapshot ??
    (await buildConversationSnapshot({
      supabase: input.supabase,
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      phoneNumber: input.phoneNumber,
      patientId: input.patientId ?? aiState.patient_id,
      aiState: serializeAiState(aiState),
      userText: input.userText,
      policySlice,
    }));
  recordSnapshotBuild(trace, "inbound", snapshot, inboundStarted);

  aiState = snapshot.aiState;

  const facts = extractFacts(
    input.userText,
    new Date(),
    aiState.booking?.offered_slots
  );
  trace.extractorsApplied = facts;

  const factPatch = resolveReferenceFacts(facts, aiState);
  if (Object.keys(factPatch).length > 0) {
    aiState = mergeAiState(aiState, factPatch);
  }

  const postExtractorsStarted = Date.now();
  snapshot = await buildConversationSnapshot({
    supabase: input.supabase,
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    phoneNumber: input.phoneNumber,
    patientId: aiState.patient_id ?? input.patientId,
    aiState: serializeAiState(aiState),
    turnFacts: facts,
    userText: input.userText,
    policySlice,
  });
  recordSnapshotBuild(trace, "post_extractors", snapshot, postExtractorsStarted);
  aiState = snapshot.aiState;

  const snapshotBlock = formatSnapshotForPrompt(snapshot);
  let flowSync = reapplyFlowSync(
    aiState,
    input.userText,
    snapshot.flowConfig,
    snapshot.customFields,
    snapshot.patient,
    facts
  );
  aiState = flowSync.aiState;

  trace.allowedTools =
    snapshot.derived.allowedTools.length > 0
      ? snapshot.derived.allowedTools
      : flowSync.allowedTools;
  trace.mutationGate = computeMutationGate(flowSync);

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
    flowBlock: `${snapshotBlock}\n\n${snapshot.derived.flowBlock}`,
  });

  const messages: ChatMessage[] = [{ role: "system", content: systemContent }];
  const allowedTools = trace.allowedTools;

  const maxContext = input.settings.max_context_messages ?? 20;
  for (const h of input.history.slice(-maxContext)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: input.userText });

  createTurnContext({
    conversationId: input.conversationId,
    clinicId: input.clinicId,
    phoneNumber: input.phoneNumber,
    patientId: snapshot.conversation.patientId,
    snapshot,
    aiState,
    clinicName: input.clinicName ?? "clínica",
    settings: input.settings,
    faqs: input.faqs,
    messages,
    turnFacts: facts,
    trace,
  });

  let handoff = false;
  let finalReply: string | null = null;
  let filteredTools = filterToolsByNames(CHATBOT_TOOLS, allowedTools);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const roundAllowed =
      snapshot.derived.allowedTools.length > 0
        ? snapshot.derived.allowedTools
        : flowSync.allowedTools;
    filteredTools = filterToolsByNames(CHATBOT_TOOLS, roundAllowed);

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

      if (toolName === "create_appointment") {
        const scheduledAt = resolveCreateAppointmentScheduledAt(args, aiState, facts);
        if (scheduledAt) {
          args = { ...args, scheduled_at: scheduledAt };
        }
      }

      const snapshotBefore = sliceSnapshotForTrace(snapshot) as unknown as Record<
        string,
        unknown
      >;
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
        void logBlockedToolCall(
          input.supabase,
          input.clinicId,
          input.conversationId,
          toolName,
          args,
          validation.message ?? "blocked"
        );
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
            flowConfig: snapshot.flowConfig,
            customFields: snapshot.customFields,
          },
          toolName,
          args
        );
      }

      const mutationOutcome =
        outcome.mutationOutcome ??
        (blocked ? "recoverable" : outcomeFromToolResult(outcome.result));

      const toolTrace = {
        toolName,
        round,
        blocked,
        blockReason: blocked ? validation?.message : undefined,
        status: outcome.result.status,
        durationMs: Date.now() - started,
        resolvedArgs: toolName === "create_appointment" ? { ...args } : undefined,
        resultMessage: outcome.result.message,
      };
      trace.tools.push(toolTrace);

      const execTrace: ExecutionTrace = {
        kind: "tool",
        name: toolName,
        outcome: mutationOutcome,
        duration_ms: toolTrace.durationMs,
        snapshotBefore,
        validation_gate: blocked ? validation?.message : undefined,
        detail: outcome.result.message,
        ...(outcome.executionTrace ?? {}),
      };
      trace.executionTraces.push(execTrace);

      if (outcome.executionTrace) {
        trace.tools[trace.tools.length - 1]!.blockReason =
          (trace.tools[trace.tools.length - 1]!.blockReason ?? "") +
          " " +
          formatExecutionTrace(outcome.executionTrace);
      }

      if (outcome.statePatch) {
        aiState = mergeAiState(aiState, outcome.statePatch);
      }
      aiState = mergeAiState(
        aiState,
        patchAiState(toolName, args, outcome.result, aiState, mutationOutcome)
      );

      snapshot = await rebuildSnapshotAfterMutation(
        input,
        aiState,
        facts,
        policySlice,
        trace
      );
      aiState = snapshot.aiState;

      const lastExec = trace.executionTraces[trace.executionTraces.length - 1];
      if (lastExec) {
        lastExec.snapshotAfter = sliceSnapshotForTrace(snapshot) as unknown as Record<
          string,
          unknown
        >;
      }

      flowSync = reapplyFlowSync(
        aiState,
        input.userText,
        snapshot.flowConfig,
        snapshot.customFields,
        snapshot.patient,
        facts
      );
      aiState = flowSync.aiState;
      trace.allowedTools =
        snapshot.derived.allowedTools.length > 0
          ? snapshot.derived.allowedTools
          : flowSync.allowedTools;

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
          flowConfig: snapshot.flowConfig,
          customFields: snapshot.customFields,
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
    trace,
  };
}

export async function runChatbotTurn(input: RunTurnInput): Promise<RunTurnResult> {
  if (!input.userText.trim()) {
    const emptyTrace = createTurnTrace(input.conversationId, input.userText);
    return {
      reply: "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?",
      statePatch: serializeAiState(normalizeAiState(input.aiState)),
      trace: emptyTrace,
    };
  }
  return runTurn(input);
}
