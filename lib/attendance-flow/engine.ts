import type { AiState } from "@/lib/chatbot/state/types";
import { BOOKING_CORE_GOAL_IDS } from "./defaults";
import { isGoalSatisfied } from "./completion";
import { evaluateWhen } from "./conditions";
import type { GoalRegistry } from "./goal-registry";
import type {
  AppointmentPolicy,
  ConversationFlowState,
  ConversationFlowsConfig,
  GoalDefinition,
  GoalEvaluationContext,
  GoalPolicyLevel,
  IntakePendency,
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
  };
}

export function syncFlowState(input: EngineInput): ConversationFlowState {
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
  };
}

const READ_TOOLS_ALWAYS = new Set([
  "lookup_patient_by_phone",
  "search_faq",
  "get_service_price",
  "list_price_options",
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
  return goal.id === "cancel_booking" ? "cancel_booking" : "booking_created";
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

  if (input.flowState.pending.includes("appointment_selected")) {
    tools.add("list_patient_appointments");
  }

  // Cancel contract: user can list/review cancellable appointments throughout cancelamento
  // (must not be blocked solely because appointment_selected is already satisfied).
  if (input.workflow.id === "cancelamento") {
    tools.add("list_patient_appointments");
  }

  if (input.workflow.id === "cancelamento" || input.workflow.id === "consulta") {
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
    workflowId === "cancelamento"
      ? ["appointment_selected"]
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
  if (!wf?.enabled && workflowId !== "cancelamento" && workflowId !== "consulta") {
    return undefined;
  }
  return wf;
}

export function markMutationDone(
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
