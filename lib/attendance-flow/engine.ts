import type { AiState } from "@/lib/chatbot/state/types";
import { BOOKING_CORE_GOAL_IDS } from "./defaults";
import { isGoalSatisfied } from "./completion";
import { evaluateWhen } from "./conditions";
import { defaultGoalRegistry, type GoalRegistry } from "./goal-registry";
import type {
  AppointmentPolicy,
  ConversationFlowState,
  ConversationFlowsConfig,
  GoalDefinition,
  GoalEvaluationContext,
  GoalPolicyLevel,
  IntakePendency,
  OperationEndReason,
  WorkflowDefinition,
  WorkflowMode,
} from "./types";

export type EngineInput = {
  workflow: WorkflowDefinition;
  policy: AppointmentPolicy;
  registry: GoalRegistry;
  aiState: AiState;
  flowState: ConversationFlowState;
  patient?: Record<string, unknown> | null;
  turnFacts?: Record<string, unknown>;
};

function buildEvalContext(input: EngineInput): GoalEvaluationContext {
  return {
    aiState: input.aiState as Record<string, unknown>,
    collected: input.flowState.collected,
    patient: input.patient,
    mutation_done: input.flowState.mutation_done,
    turnFacts: input.turnFacts,
  };
}

function effectivePriority(goal: GoalDefinition, workflow: WorkflowDefinition): number {
  return workflow.priority_overrides?.[goal.id] ?? goal.priority;
}

export function resolveEffectivePolicy(
  goalId: string,
  registry: GoalRegistry,
  policy: AppointmentPolicy
): GoalPolicyLevel {
  return registry.resolvePolicy(goalId, policy.goals);
}

export function getApplicableGoals(input: EngineInput): GoalDefinition[] {
  const ctx = buildEvalContext(input);
  return input.registry
    .getForWorkflow(input.workflow.goal_ids)
    .filter((goal) => {
      const pol = resolveEffectivePolicy(goal.id, input.registry, input.policy);
      if (pol === "ignore") return false;
      return evaluateWhen(goal.when, ctx);
    });
}

export function reevaluateGoals(input: EngineInput): {
  satisfied: string[];
  pending: string[];
} {
  const ctx = buildEvalContext(input);
  const applicable = getApplicableGoals(input);
  const satisfied: string[] = [];
  const pending: string[] = [];

  for (const goal of applicable) {
    if (isGoalSatisfied(goal.completion, ctx)) {
      satisfied.push(goal.id);
    } else {
      pending.push(goal.id);
    }
  }

  return { satisfied, pending };
}

export function resolveFocusGoal(
  pending: string[],
  goals: GoalDefinition[],
  workflow: WorkflowDefinition,
  previousFocus?: string
): string | undefined {
  if (!pending.length) return undefined;

  if (previousFocus && pending.includes(previousFocus)) {
    return previousFocus;
  }

  const byId = new Map(goals.map((g) => [g.id, g]));
  let best: { id: string; priority: number } | undefined;

  for (const id of pending) {
    const goal = byId.get(id);
    if (!goal) continue;
    const p = effectivePriority(goal, workflow);
    if (!best || p > best.priority) {
      best = { id, priority: p };
    }
  }

  return best?.id;
}

export function initConversationFlowState(
  workflow: WorkflowDefinition
): ConversationFlowState {
  return {
    active_workflow_id: workflow.id,
    mode: workflow.mode,
    satisfied: [],
    pending: [],
    collected: {},
    mutation_done: {},
    current_operation: { status: "active" },
  };
}

export function isCurrentOperationCompleted(
  flowState: ConversationFlowState
): boolean {
  return flowState.current_operation?.status === "completed";
}

/** Completed or abandoned — operation no longer has execution authority. */
export function isCurrentOperationClosed(
  flowState: ConversationFlowState
): boolean {
  const status = flowState.current_operation?.status;
  return status === "completed" || status === "abandoned";
}

export function isCurrentOperationActive(
  flowState: ConversationFlowState
): boolean {
  return flowState.current_operation?.status === "active";
}

/**
 * Lifecycle only: mark Current Operation abandoned + endReason.
 * Sync/reconcile clears pending and conversation consequences.
 */
export function abandonCurrentOperation(
  flowState: ConversationFlowState,
  reason: OperationEndReason
): ConversationFlowState {
  return {
    ...flowState,
    current_operation: {
      status: "abandoned",
      endReason: reason,
    },
  };
}

export function syncFlowState(input: EngineInput): ConversationFlowState {
  // Explicit engine status — do not infer closed from mutation_done.
  // Closed ops: sync derives cleanup (pending / focus / pending_confirmation).
  if (isCurrentOperationClosed(input.flowState)) {
    return {
      ...input.flowState,
      active_workflow_id: input.workflow.id,
      mode: input.workflow.mode,
      pending: [],
      focus_goal_id: undefined,
      pending_confirmation: undefined,
    };
  }

  const { satisfied, pending } = reevaluateGoals(input);
  const goals = getApplicableGoals(input);
  const focus_goal_id = resolveFocusGoal(
    pending,
    goals,
    input.workflow,
    input.flowState.focus_goal_id
  );

  return {
    ...input.flowState,
    active_workflow_id: input.workflow.id,
    mode: input.workflow.mode,
    satisfied,
    pending,
    focus_goal_id,
    current_operation: input.flowState.current_operation ?? { status: "active" },
  };
}

const READ_TOOLS_ALWAYS = new Set([
  "lookup_patient_by_phone",
  "search_faq",
  "get_service_price",
  "get_procedure_info",
]);

const INTAKE_GOAL_IDS = new Set([
  "cpf",
  "email",
  "guardian",
  "insurance",
  "payment_method",
  "cancel_reason",
]);

function isBookingConfirming(aiState: AiState): boolean {
  const booking = aiState.booking;
  return booking?.status === "confirming" || Boolean(booking?.pending_slot);
}

function mutationGoalIdFor(goal: GoalDefinition): string {
  if (goal.is_mutation) return goal.id;
  return "booking_created";
}

function shouldExposePendingGoalTools(goal: GoalDefinition, input: EngineInput): boolean {
  if (!input.flowState.pending.includes(goal.id)) return false;

  if (BOOKING_CORE_GOAL_IDS.includes(goal.id as (typeof BOOKING_CORE_GOAL_IDS)[number])) {
    return true;
  }

  if (INTAKE_GOAL_IDS.has(goal.id) || goal.id.startsWith("custom:")) {
    return !isBookingConfirming(input.aiState);
  }

  if (goal.id === input.flowState.focus_goal_id) return true;

  if (goal.id === "appointment_selected") return true;

  return false;
}

/** Context-based tool set — replaces single-focus filtering (Phase 3). */
export function resolveAvailableTools(input: EngineInput): string[] {
  const tools = new Set<string>(["search_faq"]);
  const goals = getApplicableGoals(input);
  const byId = new Map(goals.map((g) => [g.id, g]));

  for (const goalId of input.flowState.pending) {
    const goal = byId.get(goalId);
    if (!goal) continue;

    if (goal.is_mutation) {
      const gate = canExecuteMutation(
        mutationGoalIdFor(goal),
        input.flowState.mode,
        input.policy,
        input.registry,
        input.flowState.pending,
        input.workflow.id
      );
      if (gate.ok) {
        for (const t of goal.allowed_tools) tools.add(t);
      }
      continue;
    }

    if (!shouldExposePendingGoalTools(goal, input)) continue;
    for (const t of goal.allowed_tools) tools.add(t);
  }

  for (const t of READ_TOOLS_ALWAYS) {
    if (tools.has("lookup_patient_by_phone")) tools.add(t);
  }

  // Read tool for existing appointments — any workflow once patient is known.
  if (input.aiState.patient_id) {
    tools.add("list_patient_appointments");
  }

  if (
    input.workflow.id === "cancelamento" ||
    input.workflow.id === "consulta" ||
    input.workflow.id === "reschedule" ||
    input.workflow.id === "check_in"
  ) {
    tools.add("transfer_to_human");
  }

  return Array.from(tools);
}

/** @deprecated use resolveAvailableTools — kept for callers not yet migrated */
export function getAllowedToolsForFocus(
  input: EngineInput,
  focusGoalId?: string
): string[] {
  void focusGoalId;
  return resolveAvailableTools(input);
}

export function filterToolsByNames<T extends { function: { name: string } }>(
  allTools: T[],
  allowedNames: string[]
): T[] {
  const set = new Set(allowedNames);
  return allTools.filter((t) => set.has(t.function.name));
}

export function canExecuteMutation(
  goalId: string,
  mode: WorkflowMode,
  policy: AppointmentPolicy,
  registry: GoalRegistry,
  pending: string[],
  workflowId?: string
): { ok: true } | { ok: false; missing: string[]; message: string } {
  const goal = registry.get(goalId);
  if (!goal?.is_mutation) {
    return { ok: false, missing: [goalId], message: "Goal não é mutação." };
  }

  const coreIds =
    workflowId === "cancelamento" || workflowId === "check_in"
      ? ["appointment_selected"]
      : workflowId === "reschedule"
        ? ["appointment_selected", "slot_selected"]
        : [...BOOKING_CORE_GOAL_IDS];

  const missingCore = coreIds.filter((id) => pending.includes(id));
  if (missingCore.length) {
    return {
      ok: false,
      missing: [...missingCore],
      message: `Núcleo incompleto: ${missingCore.join(", ")}`,
    };
  }

  // before_booking + required → blocks create (all modes)
  if (goalId === "booking_created" || goalId === "create_booking") {
    const missingBefore = pending.filter((id) => {
      const g = registry.get(id);
      if (!g) return false;
      const stage = g.requiredStage ?? "optional";
      if (stage !== "before_booking") return false;
      return resolveEffectivePolicy(id, registry, policy) === "required";
    });
    if (missingBefore.length) {
      return {
        ok: false,
        missing: missingBefore,
        message: `Cadastro obrigatório pendente: ${missingBefore.join(", ")}`,
      };
    }
  }

  if (mode === "express" || mode === "assisted") {
    return { ok: true };
  }

  // strict: all required pending (except after_booking intake)
  const missingRequired = pending.filter((id) => {
    if (id === goalId) return false;
    const g = registry.get(id);
    if (g?.requiredStage === "after_booking") return false;
    const pol = resolveEffectivePolicy(id, registry, policy);
    return pol === "required";
  });

  if (missingRequired.length) {
    return {
      ok: false,
      missing: missingRequired,
      message: `Goals obrigatórios pendentes: ${missingRequired.join(", ")}`,
    };
  }

  return { ok: true };
}

export function computePendencies(input: EngineInput): IntakePendency[] {
  const { pending } = reevaluateGoals(input);
  const goals = getApplicableGoals(input);
  const byId = new Map(goals.map((g) => [g.id, g]));
  const pendencies: IntakePendency[] = [];

  for (const id of pending) {
    if (BOOKING_CORE_GOAL_IDS.includes(id as (typeof BOOKING_CORE_GOAL_IDS)[number])) {
      continue;
    }
    const goal = byId.get(id);
    if (!goal) continue;
    const pol = resolveEffectivePolicy(id, input.registry, input.policy);
    if (pol === "ignore") continue;
    pendencies.push({
      goal_id: id,
      label: goal.label,
      required: pol === "required",
    });
  }

  return pendencies;
}

export function buildGoalPromptBlock(input: EngineInput): string {
  const focusId = input.flowState.focus_goal_id;
  const focus = focusId ? input.registry.get(focusId) : undefined;
  const pendingCount = input.flowState.pending.length;
  const availableTools = resolveAvailableTools(input);

  const lines: string[] = [
    `Workflow ativo: ${input.workflow.label} (modo ${input.workflow.mode}).`,
  ];

  if (input.flowState.satisfied.length) {
    lines.push(`Goals satisfeitos: ${input.flowState.satisfied.join(", ")}.`);
  }

  if (pendingCount) {
    lines.push(`Goals pendentes (${pendingCount}): ${input.flowState.pending.join(", ")}.`);
  }

  if (focus) {
    lines.push(
      "",
      `Sugestão de foco (UX): ${focus.label} (${focus.id})`,
      focus.prompt_hint
    );
  } else if (!pendingCount) {
    lines.push("", "Todos os goals aplicáveis foram satisfeitos.");
  }

  lines.push("", `Tools disponíveis neste turno: ${availableTools.join(", ")}.`);

  return lines.join("\n");
}

export function getWorkflowFromConfig(
  config: ConversationFlowsConfig,
  workflowId: string
): WorkflowDefinition | undefined {
  const wf = config.workflows[workflowId];
  if (
    !wf?.enabled &&
    workflowId !== "cancelamento" &&
    workflowId !== "consulta" &&
    workflowId !== "reschedule" &&
    workflowId !== "check_in"
  ) {
    return undefined;
  }
  return wf;
}

/** Private — only completeCurrentOperation may mark mutation_done. */
function markMutationDoneInternal(
  flowState: ConversationFlowState,
  key: string
): ConversationFlowState {
  return {
    ...flowState,
    mutation_done: {
      ...(flowState.mutation_done ?? {}),
      [key]: true,
    },
  };
}

/**
 * Reset Current Operation from workflow.runtime.resetSpec (metadata).
 * Prefer completeCurrentOperation from tool executes.
 */
export function resetCurrentOperation(
  flowState: ConversationFlowState,
  workflow: WorkflowDefinition
): ConversationFlowState {
  const spec = workflow.runtime?.resetSpec;
  if (!spec) {
    return {
      ...flowState,
      current_operation: { status: "active" },
    };
  }

  const collected = { ...(flowState.collected ?? {}) };
  for (const key of spec.collectedKeys ?? []) {
    delete collected[key];
  }

  const mutation_done = { ...(flowState.mutation_done ?? {}) };
  for (const key of spec.mutationKeys) {
    mutation_done[key] = false;
  }

  return {
    ...flowState,
    collected,
    mutation_done,
    current_operation: { status: "active" },
    pending: [],
    satisfied: [],
    focus_goal_id: undefined,
  };
}

/**
 * @deprecated Use completeCurrentOperation from executes. Kept as shim for cancel resetSpec.
 */
export function resetCurrentCancelOperation(
  flowState: ConversationFlowState,
  workflow?: WorkflowDefinition
): ConversationFlowState {
  if (workflow) return resetCurrentOperation(flowState, workflow);
  // Shim when workflow not passed: mirror cancel resetSpec defaults.
  const collected = { ...(flowState.collected ?? {}) };
  delete collected.cancel_reason;
  delete collected["custom:cancel_reason"];
  const mutation_done = { ...(flowState.mutation_done ?? {}) };
  mutation_done.cancel_booking = false;
  return {
    ...flowState,
    collected,
    mutation_done,
    current_operation: { status: "active" },
  };
}

export type CompleteCurrentOperationInput = {
  workflow: WorkflowDefinition;
  flowState: ConversationFlowState;
  mutationSucceeded: boolean;
  /**
   * When true: always close the Current Operation (ignore remainingTargets).
   * Used by reschedule / create.
   */
  complete?: boolean;
  /** Cancel (multi-target): remaining after cancel; ignored when complete: true. */
  remainingTargets?: string[];
};

function closeCurrentOperation(
  flowState: ConversationFlowState,
  workflow: WorkflowDefinition
): ConversationFlowState {
  const keys = workflow.runtime?.resetSpec?.mutationKeys ?? [];
  let next: ConversationFlowState = {
    ...flowState,
    current_operation: { status: "completed" },
    pending: [],
    focus_goal_id: undefined,
  };
  for (const key of keys) {
    next = markMutationDoneInternal(next, key);
  }
  return next;
}

/**
 * Sole authorized API for finishing a Current Operation after a mutation.
 * Executes must not call markMutationDoneInternal / resetCurrentOperation directly
 * except through this helper (reset path for multi-cancel remaining).
 */
export function completeCurrentOperation(
  input: CompleteCurrentOperationInput
): ConversationFlowState {
  const { workflow, flowState, mutationSucceeded, complete, remainingTargets } =
    input;
  if (!mutationSucceeded) return flowState;

  if (complete) {
    return closeCurrentOperation(flowState, workflow);
  }

  const remaining = remainingTargets ?? [];
  if (remaining.length > 0) {
    return resetCurrentOperation(flowState, workflow);
  }

  return closeCurrentOperation(flowState, workflow);
}

/** Minimal state for Safety ↔ Conversation continuation check. */
export type DeterministicStepState = {
  conversation_flow?: ConversationFlowState | null;
  focused_appointment_id?: string | null;
  active_appointments?: string[] | null;
  booking?: AiState["booking"] | null;
  offered_doctors?: AiState["offered_doctors"] | null;
  offered_procedures?: AiState["offered_procedures"] | null;
  offered_days?: AiState["offered_days"] | null;
};

function hasMigrationBookingContinuation(aiState: DeterministicStepState): boolean {
  if ((aiState.offered_doctors?.length ?? 0) > 0) return true;
  if ((aiState.offered_procedures?.length ?? 0) > 0) return true;
  if ((aiState.offered_days?.length ?? 0) > 0) return true;
  if ((aiState.booking?.offered_slots?.length ?? 0) > 0) return true;

  const booking = aiState.booking;
  if (!booking || booking.status === "done") return false;
  if (booking.procedure_id || booking.doctor_id) {
    return booking.status === "collecting" || booking.status === "confirming";
  }
  return false;
}

/**
 * Does Conversation State have a next step the system can take without the LLM deciding?
 * Prefer Current Operation (pending mutation / deterministic pending goals).
 * Migration fallbacks (booking menus, focus, active_appointments) must shrink over time.
 */
export function hasPendingDeterministicStep(
  aiState?: DeterministicStepState | null,
  registry: GoalRegistry = defaultGoalRegistry
): boolean {
  if (!aiState) return false;

  const flow = aiState.conversation_flow;
  // Closed operation: no Current Operation continuation (focus alone is not enough).
  if (flow && isCurrentOperationClosed(flow)) {
    return hasMigrationBookingContinuation(aiState);
  }

  if (flow?.pending?.length) {
    for (const goalId of flow.pending) {
      const goal = registry.get(goalId);
      if (goal?.is_mutation) return true;
    }
    // Selecting without focus → list is obligatory (Current Operation).
    if (
      flow.pending.includes("appointment_selected") &&
      !aiState.focused_appointment_id?.trim()
    ) {
      return true;
    }
    // Slot collection with hydrated doctor/procedure → slots are obligatory.
    if (
      flow.pending.includes("slot_selected") &&
      aiState.booking?.doctor_id &&
      aiState.booking?.procedure_id
    ) {
      return true;
    }
  }

  // --- Migration fallbacks (debt; shrink over time, do not grow) ---
  if (hasMigrationBookingContinuation(aiState)) return true;
  if (aiState.focused_appointment_id?.trim()) return true;
  if ((aiState.active_appointments?.length ?? 0) > 0) return true;

  return false;
}

