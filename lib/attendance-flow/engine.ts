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
};

function buildEvalContext(input: EngineInput): GoalEvaluationContext {
  return {
    aiState: input.aiState as Record<string, unknown>,
    collected: input.flowState.collected,
    patient: input.patient,
    mutation_done: input.flowState.mutation_done,
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

export function getAllowedToolsForFocus(
  input: EngineInput,
  focusGoalId?: string
): string[] {
  const focus = focusGoalId ?? input.flowState.focus_goal_id;
  if (!focus) {
    return ["search_faq", "transfer_to_human"];
  }

  const goal = input.registry.get(focus);
  if (!goal) return ["search_faq", "transfer_to_human"];

  const tools = new Set(goal.allowed_tools);
  for (const t of READ_TOOLS_ALWAYS) {
    if (goal.allowed_tools.includes("lookup_patient_by_phone")) {
      tools.add(t);
    }
  }

  if (input.workflow.id === "cancelamento" || input.workflow.id === "consulta") {
    tools.add("transfer_to_human");
  }

  return Array.from(tools);
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

  if (mode === "express" || mode === "assisted") {
    const missingCore = coreIds.filter((id) => pending.includes(id));
    if (missingCore.length) {
      return {
        ok: false,
        missing: [...missingCore],
        message: `Núcleo incompleto: ${missingCore.join(", ")}`,
      };
    }
    return { ok: true };
  }

  // strict
  const missingRequired = pending.filter((id) => {
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
      `FOCO ATUAL: ${focus.label} (${focus.id})`,
      focus.prompt_hint,
      `Tools permitidas neste foco: ${focus.allowed_tools.join(", ")}.`
    );
  } else if (!pendingCount) {
    lines.push("", "Todos os goals aplicáveis foram satisfeitos.");
  }

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
