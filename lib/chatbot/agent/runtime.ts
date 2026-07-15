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
import { resolveReferenceFacts, applySemanticFacts } from "../state/resolve-facts";
import { buildChatbotFallbackReply } from "../state/format-for-prompt";
import { hydrateBookingFromAppointment } from "../state/hydrate-booking-from-appointment";
import { sanitizeStaleBooking } from "../state/sanitize-stale-booking";
import { normalizeAiState, serializeAiState } from "../state/migrate";
import type { AiState } from "../state/types";
import { CHATBOT_TOOLS } from "../tools/definitions";
import { executeTool, logBlockedToolCall } from "../tools/execute";
import type { FaqItem } from "../tools/types";
import { toolResultToJson } from "../tools/types";
import { buildSystemPrompt } from "./prompt";
import { createChatCompletion, logTokenUsage, type ChatMessage } from "./llm";
import { canExecuteMutation, filterToolsByNames, initConversationFlowState } from "@/lib/attendance-flow/engine";
import { applyPlatformToolGate } from "@/lib/assistant-platform";
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
import {
  autoFocusSingleRescheduleAppointment,
  autoFocusSingleCheckInAppointment,
  resolveDeterministicActions,
  buildLastDeterministicActionPatch,
  mapToolStatusToDeterministicOutcome,
} from "./deterministic-actions";
import {
  resolveReply,
  shouldSkipLlmForAuthoritativeReply,
  type ReplyDecision,
} from "./reply-policy";
import {
  renderSlotConfirmation,
  renderSlotList,
  renderStructuredToolResult,
} from "../tools/render-structured";
import type { NormalizedFacts } from "../extractors/types";
import {
  getValidOfferedSlots,
  hasValidPendingSlot,
} from "../state/selection-context";
import { hasDateIntent } from "../extractors/date";
import {
  buildCreateAppointmentArgsFromState,
  isOperationChangingTool,
  isTerminalMutationFailure,
  terminalMutationErrorMessage,
} from "./terminal-mutation";
import {
  BOOKING_FORK_PROMPT,
  shouldOfferBookingFork,
  shouldResolveBookingFork,
} from "./booking-fork";
import { DEFAULT_WORKFLOW_REMARCACAO } from "@/lib/attendance-flow/defaults";

const MAX_TOOL_ROUNDS = 5;

const STRUCTURED_RENDER_OPTS = {
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
} as const;

/**
 * Guards for slot selection contract (no LLM inventing choices).
 * Returns patient-visible text when the turn must stop without calling the LLM.
 * Uses only selection-context-valid offered slots (never stale lists).
 */
function resolveSlotSelectionGuardReply(
  aiState: AiState,
  facts: NormalizedFacts & Record<string, unknown>,
  userText: string
): string | null {
  const offered = getValidOfferedSlots(aiState.booking);
  if (!offered.length) return null;

  // Date-correction turns must reach daySelectedRule / LLM — not relist stale day.
  if (facts.date || hasDateIntent(userText)) return null;

  const pendingOk = hasValidPendingSlot(aiState.booking);

  if (facts.time_unmatched === true) {
    return renderSlotList({
      slots: offered,
      notFoundHour: facts.unresolved_hour
        ? String(facts.unresolved_hour)
        : undefined,
    }).text;
  }

  if (facts.confirmed === true && !pendingOk) {
    return renderSlotList({ slots: offered }).text;
  }

  return null;
}

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

function needsRescheduleHydrate(aiState: AiState): boolean {
  if (aiState.conversation_flow?.active_workflow_id !== "reschedule") return false;
  const focus = aiState.focused_appointment_id?.trim();
  if (!focus) return false;
  if (aiState.booking?.doctor_id && aiState.booking?.procedure_id) return false;
  return true;
}

/** When remarcação has focus but booking lacks doctor/procedure, hydrate from appointment row. */
async function hydrateRescheduleFocusIfNeeded(
  supabase: SupabaseClient,
  clinicId: string,
  aiState: AiState
): Promise<AiState> {
  if (!needsRescheduleHydrate(aiState)) return aiState;
  const appointmentId = aiState.focused_appointment_id!.trim();
  const { data } = await supabase
    .from("appointments")
    .select("id, doctor_id, procedure_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data?.id) return aiState;
  return mergeAiState(
    aiState,
    hydrateBookingFromAppointment(
      {
        id: String(data.id),
        doctor_id: data.doctor_id,
        procedure_id: data.procedure_id,
      },
      aiState
    )
  );
}

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
  let aiState: AiState = sanitizeStaleBooking(normalizeAiState(input.aiState));
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

  const aiStateBeforeFacts: AiState = { ...aiState, booking: aiState.booking ? { ...aiState.booking } : undefined };

  const facts = extractFacts(
    input.userText,
    new Date(),
    getValidOfferedSlots(aiState.booking)
  );
  trace.extractorsApplied = facts;

  const refPatch = resolveReferenceFacts(facts, aiState);
  if (Object.keys(refPatch).length > 0) {
    aiState = mergeAiState(aiState, refPatch);
  }
  const semanticPatch = applySemanticFacts(facts, aiState);
  if (Object.keys(semanticPatch).length > 0) {
    aiState = mergeAiState(aiState, semanticPatch);
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

  let flowSync = reapplyFlowSync(
    aiState,
    input.userText,
    snapshot.flowConfig,
    snapshot.customFields,
    snapshot.patient,
    facts
  );
  aiState = flowSync.aiState;

  aiState = autoFocusSingleRescheduleAppointment(aiState);
  aiState = autoFocusSingleCheckInAppointment(aiState);

  aiState = await hydrateRescheduleFocusIfNeeded(
    input.supabase,
    input.clinicId,
    aiState
  );
  // Re-sync after hydrate so tools/pending reflect doctor+procedure.
  if (
    aiState.conversation_flow?.active_workflow_id === "reschedule" &&
    aiState.booking?.doctor_id &&
    aiState.booking?.procedure_id
  ) {
    flowSync = reapplyFlowSync(
      aiState,
      input.userText,
      snapshot.flowConfig,
      snapshot.customFields,
      snapshot.patient,
      facts
    );
    aiState = flowSync.aiState;
  }

  // Soft fork: upcoming appointments + starting consulta without doctor/procedure.
  const upcomingCount = snapshot.appointments?.length ?? 0;
  const forkResolution = shouldResolveBookingFork(aiState, input.userText);
  let bookingForkBlocksTurn = false;

  if (forkResolution === "reprompt") {
    aiState = mergeAiState(aiState, {
      booking_fork: { status: "awaiting_choice" },
    });
    bookingForkBlocksTurn = true;
  } else if (forkResolution === "new") {
    aiState = mergeAiState(aiState, { booking_fork: { status: "new" } });
  } else if (forkResolution === "alter") {
    aiState = mergeAiState(aiState, {
      booking_fork: { status: "alter" },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["appointment_selected", "reschedule_booking"],
      },
    });
    flowSync = reapplyFlowSync(
      aiState,
      input.userText,
      snapshot.flowConfig,
      snapshot.customFields,
      snapshot.patient,
      facts
    );
    aiState = flowSync.aiState;
  } else if (shouldOfferBookingFork(aiState, upcomingCount, input.userText)) {
    aiState = mergeAiState(aiState, {
      booking_fork: { status: "awaiting_choice" },
    });
    bookingForkBlocksTurn = true;
  }

  const deterministicActions = bookingForkBlocksTurn
    ? []
    : resolveDeterministicActions({
        before: aiStateBeforeFacts,
        after: aiState,
        facts,
      });

  /** Structured renderer projections own patient-visible content when present. */
  let authoritativeStructuredReply: string | null = null;
  let structuredReason = "structured_renderer";
  /** Domain / tool.message when no structured projection. */
  let authoritativeDomainMessage: string | null = null;
  let domainReason = "domain_message";

  if (bookingForkBlocksTurn) {
    authoritativeDomainMessage = BOOKING_FORK_PROMPT;
    domainReason = "booking_fork";
  }

  const absorbToolReply = (
    result: { message?: string; renderStrategy?: string; status?: string },
    reasonPrefix: string
  ) => {
    const rendered = renderStructuredToolResult(result, STRUCTURED_RENDER_OPTS);
    if (rendered?.text?.trim()) {
      authoritativeStructuredReply = rendered.text.trim();
      structuredReason = `${reasonPrefix}_structured`;
      return;
    }
    const msg = result.message?.trim();
    if (msg) {
      authoritativeDomainMessage = msg;
      domainReason = `${reasonPrefix}_${result.status ?? "message"}`;
    }
  };

  const deterministicToolMessages: ChatMessage[] = [];
  /** After a terminal mutation fails, freeze the turn (no further mutations / op changes). */
  let terminalMutationFailed = false;

  for (const action of deterministicActions) {
    if (terminalMutationFailed && isOperationChangingTool(action.toolName)) {
      break;
    }
    const snapshotBefore = sliceSnapshotForTrace(snapshot) as unknown as Record<
      string,
      unknown
    >;
    const started = Date.now();
    let args = { ...action.args };
    if (action.toolName === "create_appointment") {
      const fromState = buildCreateAppointmentArgsFromState(aiState);
      if (fromState) args = fromState;
    }
    const validation = validateToolCall(
      action.toolName,
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
        action.toolName,
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
        action.toolName,
        args
      );
    }

    const mutationOutcome =
      outcome.mutationOutcome ??
      (blocked ? "recoverable" : outcomeFromToolResult(outcome.result));

    const toolCallId = `det_${action.reason}_${started}`;
    trace.tools.push({
      toolName: action.toolName,
      round: -1,
      blocked,
      blockReason: blocked
        ? validation?.message
        : `deterministic:${action.reason}`,
      status: outcome.result.status,
      durationMs: Date.now() - started,
      resultMessage: outcome.result.message,
      resolvedArgs:
        action.toolName === "create_appointment" ? { ...args } : undefined,
    });

    const detExec: ExecutionTrace = {
      kind: "tool",
      name: action.toolName,
      outcome: mutationOutcome,
      duration_ms: Date.now() - started,
      snapshotBefore,
      validation_gate: blocked ? validation?.message : undefined,
      detail: `deterministic:${action.reason} ${outcome.result.message ?? ""}`.trim(),
    };
    if (outcome.listExecutionTrace) {
      detExec.listExecutionTrace = outcome.listExecutionTrace;
      detExec.detail = `deterministic:${action.reason} stages ${outcome.listExecutionTrace.stages.beforeFilters}→${outcome.listExecutionTrace.stages.afterStatusFilter}→${outcome.listExecutionTrace.stages.afterDateFilter}→${outcome.listExecutionTrace.stages.resultCount}`;
    }
    trace.executionTraces.push(detExec);

    if (outcome.statePatch) {
      aiState = mergeAiState(aiState, outcome.statePatch);
    }
    aiState = mergeAiState(
      aiState,
      patchAiState(action.toolName, args, outcome.result, aiState, mutationOutcome)
    );

    absorbToolReply(outcome.result, `deterministic:${action.reason}`);

    if (isTerminalMutationFailure(action.toolName, mutationOutcome, outcome.result)) {
      terminalMutationFailed = true;
      // Hard errors freeze with retry copy. Soft domain outcomes (conflict → new slots)
      // keep their structured/domain absorb reply.
      if (outcome.result.status === "error") {
        authoritativeStructuredReply = null;
        authoritativeDomainMessage = terminalMutationErrorMessage(
          action.toolName,
          outcome.result.message
        );
        domainReason = `terminal_mutation_failed:${action.toolName}`;
      }
    }

    aiState = mergeAiState(
      aiState,
      buildLastDeterministicActionPatch(
        action.reason,
        { before: aiStateBeforeFacts, after: aiState, facts },
        mapToolStatusToDeterministicOutcome(outcome.result.status)
      )
    );

    snapshot = await rebuildSnapshotAfterMutation(
      input,
      aiState,
      facts,
      policySlice,
      trace
    );
    aiState = snapshot.aiState;

    flowSync = reapplyFlowSync(
      aiState,
      input.userText,
      snapshot.flowConfig,
      snapshot.customFields,
      snapshot.patient,
      facts
    );
    aiState = flowSync.aiState;

    deterministicToolMessages.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: action.toolName,
            arguments: JSON.stringify(args),
          },
        },
      ],
    });
    deterministicToolMessages.push({
      role: "tool",
      tool_call_id: toolCallId,
      name: action.toolName,
      content: toolResultToJson(outcome.result),
    });

    if (terminalMutationFailed) break;
  }

  const slotGuardReply = resolveSlotSelectionGuardReply(
    aiState,
    facts,
    input.userText
  );
  if (slotGuardReply) {
    authoritativeStructuredReply = slotGuardReply;
    structuredReason = "slot_selection_guard";
  }

  // Operational datetime: never let the LLM invent confirmation copy.
  const pendingThisTurn =
    hasValidPendingSlot(aiState.booking) &&
    facts.confirmed !== true &&
    (!hasValidPendingSlot(aiStateBeforeFacts.booking) ||
      aiState.booking?.pending_slot !== aiStateBeforeFacts.booking?.pending_slot);

  if (
    pendingThisTurn &&
    !authoritativeStructuredReply &&
    !authoritativeDomainMessage
  ) {
    const conf = renderSlotConfirmation({
      pendingSlot: aiState.booking?.pending_slot,
      offeredSlots: getValidOfferedSlots(aiState.booking),
      askConfirm: true,
    });
    if (conf?.text) {
      authoritativeStructuredReply = conf.text;
      structuredReason = "pending_slot_confirmation";
    }
  }

  const skipLlm =
    Boolean(slotGuardReply) ||
    structuredReason === "pending_slot_confirmation" ||
    shouldSkipLlmForAuthoritativeReply(
      authoritativeStructuredReply,
      authoritativeDomainMessage
    );

  const snapshotBlock = formatSnapshotForPrompt(snapshot);

  trace.allowedTools = applyPlatformToolGate({
    toolNames:
      snapshot.derived.allowedTools.length > 0
        ? snapshot.derived.allowedTools
        : flowSync.allowedTools,
    appointmentPolicy: flowConfig.appointmentPolicy,
    conversationFlows: flowConfig.conversationFlows,
    vaSettings: input.settings,
  });
  trace.mutationGate = computeMutationGate(flowSync);

  let handoff = false;
  let finalReply: string | null = null;

  if (!skipLlm) {
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
  messages.push(...deterministicToolMessages);

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

  let filteredTools = filterToolsByNames(CHATBOT_TOOLS, allowedTools);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const roundAllowedRaw =
      snapshot.derived.allowedTools.length > 0
        ? snapshot.derived.allowedTools
        : flowSync.allowedTools;
    const roundAllowed = applyPlatformToolGate({
      toolNames: roundAllowedRaw,
      appointmentPolicy: flowConfig.appointmentPolicy,
      conversationFlows: flowConfig.conversationFlows,
      vaSettings: input.settings,
    });
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
      if (terminalMutationFailed) break;

      const toolName = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      if (terminalMutationFailed && isOperationChangingTool(toolName)) {
        break;
      }

      if (toolName === "create_appointment") {
        const fromState = buildCreateAppointmentArgsFromState(aiState);
        if (fromState) {
          args = fromState;
        } else {
          const scheduledAt = resolveCreateAppointmentScheduledAt(args, aiState, facts);
          if (scheduledAt) args = { ...args, scheduled_at: scheduledAt };
        }
      } else if (toolName === "reschedule_appointment") {
        const scheduledAt = resolveCreateAppointmentScheduledAt(
          { ...args, scheduled_at: args.new_scheduled_at ?? args.scheduled_at },
          aiState,
          facts
        );
        if (scheduledAt) {
          args = { ...args, new_scheduled_at: scheduledAt };
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
      // Measured duration and list surgical replay must not be overwritten by tool-provided partials.
      execTrace.duration_ms = toolTrace.durationMs;
      if (outcome.listExecutionTrace) {
        execTrace.listExecutionTrace = outcome.listExecutionTrace;
        execTrace.detail = `stages ${outcome.listExecutionTrace.stages.beforeFilters}→${outcome.listExecutionTrace.stages.afterStatusFilter}→${outcome.listExecutionTrace.stages.afterDateFilter}→${outcome.listExecutionTrace.stages.resultCount}`;
      }
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
      trace.allowedTools = applyPlatformToolGate({
        toolNames:
          snapshot.derived.allowedTools.length > 0
            ? snapshot.derived.allowedTools
            : flowSync.allowedTools,
        appointmentPolicy: flowConfig.appointmentPolicy,
        conversationFlows: flowConfig.conversationFlows,
        vaSettings: input.settings,
      });

      if (outcome.handoff) {
        handoff = true;
        trace.handoff = true;
        trace.handoffReason = String(args.reason ?? toolName);
      }

      absorbToolReply(outcome.result, `llm_tool:${toolName}`);

      if (isTerminalMutationFailure(toolName, mutationOutcome, outcome.result)) {
        terminalMutationFailed = true;
        if (outcome.result.status === "error") {
          authoritativeStructuredReply = null;
          authoritativeDomainMessage = terminalMutationErrorMessage(
            toolName,
            outcome.result.message
          );
          domainReason = `terminal_mutation_failed:${toolName}`;
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: toolName,
        content: toolResultToJson(outcome.result),
      });

      if (terminalMutationFailed) break;
    }

    if (terminalMutationFailed) break;

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
  } // end if (!skipLlm)

  // ReplyPolicy: Structured → Domain → LLM → Fallback (authoritative tools beat LLM).
  let replyDecision: ReplyDecision;
  if (handoff && finalReply) {
    replyDecision = {
      reply: finalReply,
      source: "domain",
      reason: "handoff",
      llmUsed: !skipLlm,
    };
  } else {
    replyDecision = resolveReply({
      structuredReply: authoritativeStructuredReply,
      structuredReason,
      domainMessage: authoritativeDomainMessage,
      domainReason,
      llmReply: skipLlm ? null : finalReply,
      llmReason: "llm_completion",
      fallbackReply: buildChatbotFallbackReply(aiState),
      fallbackReason: "fallback_static",
    });
  }
  trace.replyDecision = {
    source: replyDecision.source,
    reason: replyDecision.reason,
    llmUsed: replyDecision.llmUsed,
  };
  finalReply = replyDecision.reply;

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
