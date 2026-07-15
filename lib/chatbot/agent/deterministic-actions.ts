import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "../state/types";
import { getValidOfferedSlots, hasValidPendingSlot } from "../state/selection-context";

export type DeterministicAction = {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
};

export type DeterministicActionContext = {
  before: AiState;
  after: AiState;
  facts: NormalizedFacts;
};

export type DeterministicActionOutcome = "empty" | "success" | "blocked";

export type LastDeterministicAction = {
  id: string;
  fingerprint: string;
  outcome: DeterministicActionOutcome;
};

export type DeterministicActionRule = {
  id: string;
  /** Required — authority is active_workflow_id. Missing → configuration error. */
  workflow: string;
  matches: (ctx: DeterministicActionContext) => boolean;
  execute: (ctx: DeterministicActionContext) => DeterministicAction | null;
  /** Fingerprint of facts that gate this rule (for idempotence). */
  fingerprint?: (ctx: DeterministicActionContext) => string;
};

export class DeterministicRuleConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeterministicRuleConfigurationError";
  }
}

function selectionFiltersChanged(before: AiState, after: AiState): boolean {
  const b = before.booking;
  const a = after.booking;
  if ((b?.date ?? "") !== (a?.date ?? "")) return true;
  if ((b?.doctor_id ?? "") !== (a?.doctor_id ?? "")) return true;
  if ((b?.procedure_id ?? "") !== (a?.procedure_id ?? "")) return true;
  if ((b?.selection_context?.version ?? 0) !== (a?.selection_context?.version ?? 0)) {
    return true;
  }
  if ((b?.selection_context?.period ?? null) !== (a?.selection_context?.period ?? null)) {
    return true;
  }
  return false;
}

function defaultFingerprint(ctx: DeterministicActionContext, ruleId: string): string {
  const flow = ctx.after.conversation_flow;
  return [
    ruleId,
    flow?.active_workflow_id ?? "",
    flow?.current_operation?.status ?? "",
    (flow?.pending ?? []).join(","),
    ctx.after.focused_appointment_id ?? "",
    ctx.after.booking?.date ?? "",
    ctx.after.booking?.doctor_id ?? "",
    ctx.after.booking?.procedure_id ?? "",
    String(ctx.facts.selectedIndex ?? ""),
    String(ctx.facts.confirmed ?? ""),
  ].join("|");
}

/**
 * Day/filters resolved + doctor/procedure ready + no valid slots → must fetch times.
 */
export const daySelectedRule: DeterministicActionRule = {
  id: "day_selected",
  workflow: "consulta",
  matches(ctx) {
    const date = ctx.after.booking?.date?.trim();
    if (!date) return false;
    if (!ctx.after.booking?.doctor_id || !ctx.after.booking?.procedure_id) return false;
    if (getValidOfferedSlots(ctx.after.booking).length > 0) return false;
    return selectionFiltersChanged(ctx.before, ctx.after);
  },
  execute(ctx) {
    const date = ctx.after.booking?.date?.trim();
    if (!date) return null;
    const periodFromFacts =
      ctx.facts.period === "manha" || ctx.facts.period === "tarde"
        ? ctx.facts.period
        : undefined;
    const periodFromCtx = ctx.after.booking?.selection_context?.period;
    const period =
      periodFromFacts ??
      (periodFromCtx === "manha" || periodFromCtx === "tarde" ? periodFromCtx : undefined);
    return {
      toolName: "find_available_slots",
      args: {
        date,
        doctor_id: ctx.after.booking?.doctor_id,
        procedure_id: ctx.after.booking?.procedure_id,
        ...(period ? { period } : {}),
      },
      reason: "day_selected",
    };
  },
};

export const cancelNeedsListRule: DeterministicActionRule = {
  id: "cancel_needs_list",
  workflow: "cancelamento",
  matches(ctx) {
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status != null && flow.current_operation.status !== "active") {
      return false;
    }
    if (flow?.active_workflow_id !== "cancelamento") return false;
    if (!flow.pending.includes("appointment_selected")) return false;
    if (!flow.pending.includes("cancel_booking")) return false;
    if (ctx.after.focused_appointment_id?.trim()) return false;
    return true;
  },
  execute() {
    return {
      toolName: "list_patient_appointments",
      args: {},
      reason: "cancel_needs_list",
    };
  },
};

export const rescheduleNeedsListRule: DeterministicActionRule = {
  id: "reschedule_needs_list",
  workflow: "reschedule",
  matches(ctx) {
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status != null && flow.current_operation.status !== "active") {
      return false;
    }
    if (flow?.active_workflow_id !== "reschedule") return false;
    if (!flow.pending.includes("appointment_selected")) return false;
    if (!flow.pending.includes("reschedule_booking")) return false;
    if (ctx.after.focused_appointment_id?.trim()) return false;
    return true;
  },
  execute() {
    return {
      toolName: "list_patient_appointments",
      args: {},
      reason: "reschedule_needs_list",
    };
  },
};

export const checkInNeedsListRule: DeterministicActionRule = {
  id: "check_in_needs_list",
  workflow: "check_in",
  matches(ctx) {
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status != null && flow.current_operation.status !== "active") {
      return false;
    }
    if (flow?.active_workflow_id !== "check_in") return false;
    if (!flow.pending.includes("appointment_selected")) return false;
    if (!flow.pending.includes("check_in")) return false;
    if (ctx.after.focused_appointment_id?.trim()) return false;
    return true;
  },
  execute() {
    return {
      toolName: "list_patient_appointments",
      args: {},
      reason: "check_in_needs_list",
    };
  },
};

export const checkInConfirmedRule: DeterministicActionRule = {
  id: "check_in_confirmed",
  workflow: "check_in",
  matches(ctx) {
    if (ctx.facts.confirmed !== true) return false;
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status != null && flow.current_operation.status !== "active") {
      return false;
    }
    if (flow?.active_workflow_id !== "check_in") return false;
    if (!flow.pending.includes("check_in")) return false;
    if (!ctx.after.focused_appointment_id?.trim()) return false;
    return true;
  },
  execute(ctx) {
    const appointmentId = ctx.after.focused_appointment_id?.trim();
    if (!appointmentId) return null;
    return {
      toolName: "perform_check_in",
      args: { appointment_id: appointmentId },
      reason: "check_in_confirmed",
    };
  },
};

export const rescheduleSlotConfirmedRule: DeterministicActionRule = {
  id: "reschedule_slot_confirmed",
  workflow: "reschedule",
  matches(ctx) {
    if (ctx.facts.confirmed !== true) return false;
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status != null && flow.current_operation.status !== "active") {
      return false;
    }
    if (flow?.active_workflow_id !== "reschedule") return false;
    if (!flow.pending.includes("reschedule_booking")) return false;
    if (!ctx.after.focused_appointment_id?.trim()) return false;
    if (!ctx.after.booking?.pending_slot?.trim()) return false;
    if (
      ctx.after.booking.selection_context?.version != null &&
      ctx.after.booking.selection_epoch !== ctx.after.booking.selection_context.version
    ) {
      return false;
    }
    return true;
  },
  execute(ctx) {
    const pending = ctx.after.booking?.pending_slot?.trim();
    const appointmentId = ctx.after.focused_appointment_id?.trim();
    if (!pending || !appointmentId) return null;
    return {
      toolName: "reschedule_appointment",
      args: {
        appointment_id: appointmentId,
        new_scheduled_at: pending,
      },
      reason: "reschedule_slot_confirmed",
    };
  },
};

/**
 * Confirmed mutation (create): LLM only acknowledges Sim.
 * Args are built exclusively from booking / patient domain state.
 */
export const createSlotConfirmedRule: DeterministicActionRule = {
  id: "create_slot_confirmed",
  workflow: "consulta",
  matches(ctx) {
    if (ctx.facts.confirmed !== true) return false;
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status != null && flow.current_operation.status !== "active") {
      return false;
    }
    if (flow?.active_workflow_id && flow.active_workflow_id !== "consulta") {
      return false;
    }
    if (!ctx.after.patient_id?.trim()) return false;
    if (!ctx.after.booking?.doctor_id?.trim()) return false;
    if (!ctx.after.booking?.procedure_id?.trim()) return false;
    if (!hasValidPendingSlot(ctx.after.booking)) return false;
    return true;
  },
  execute(ctx) {
    const patientId = ctx.after.patient_id?.trim();
    const doctorId = ctx.after.booking?.doctor_id?.trim();
    const procedureId = ctx.after.booking?.procedure_id?.trim();
    const pending = ctx.after.booking?.pending_slot?.trim();
    if (!patientId || !doctorId || !procedureId || !pending) return null;
    return {
      toolName: "create_appointment",
      args: {
        patient_id: patientId,
        doctor_id: doctorId,
        procedure_id: procedureId,
        scheduled_at: pending,
      },
      reason: "create_slot_confirmed",
    };
  },
  fingerprint(ctx) {
    return [
      "create_slot_confirmed",
      ctx.after.patient_id ?? "",
      ctx.after.booking?.doctor_id ?? "",
      ctx.after.booking?.procedure_id ?? "",
      ctx.after.booking?.pending_slot ?? "",
      String(ctx.after.booking?.selection_epoch ?? ""),
    ].join("|");
  },
};

/**
 * day_selected also applies during remarcação when booking date filters change.
 * Dual registration: same logic, different workflow authority.
 */
export const daySelectedRescheduleRule: DeterministicActionRule = {
  ...daySelectedRule,
  id: "day_selected_reschedule",
  workflow: "reschedule",
};

const rules: DeterministicActionRule[] = [
  daySelectedRule,
  daySelectedRescheduleRule,
  cancelNeedsListRule,
  rescheduleNeedsListRule,
  checkInNeedsListRule,
  createSlotConfirmedRule,
  rescheduleSlotConfirmedRule,
  checkInConfirmedRule,
];

function isOperationActive(ctx: DeterministicActionContext): boolean {
  const status = ctx.after.conversation_flow?.current_operation?.status;
  if (status == null) return true;
  return status === "active";
}

function canExecuteRule(
  rule: DeterministicActionRule,
  activeWorkflowId: string | undefined
): boolean {
  if (rule.workflow === undefined) {
    throw new DeterministicRuleConfigurationError(
      `deterministic rule "${rule.id}" missing workflow`
    );
  }
  // day_selected for consulta: also allow when no conversation_flow (legacy) or consulta
  if (!activeWorkflowId) {
    return rule.workflow === "consulta";
  }
  return rule.workflow === activeWorkflowId;
}

function shouldSkipIdempotent(
  rule: DeterministicActionRule,
  ctx: DeterministicActionContext
): boolean {
  const last = ctx.after.last_deterministic_action;
  if (!last || last.id !== rule.id) return false;
  // Failed / empty confirmed mutations must be retriable (e.g. Sim after create error).
  if (last.outcome !== "success") return false;
  const fp =
    rule.fingerprint?.(ctx) ?? defaultFingerprint(ctx, rule.id);
  return last.fingerprint === fp;
}

/**
 * Given state before/after fact resolution: is there a tool that must run without the LLM?
 * Barriers: ACTIVE operation → workflow authority → idempotence.
 */
export function resolveDeterministicActions(
  ctx: DeterministicActionContext
): DeterministicAction[] {
  if (!isOperationActive(ctx)) {
    return [];
  }

  const activeWorkflow = ctx.after.conversation_flow?.active_workflow_id;
  const actions: DeterministicAction[] = [];

  for (const rule of rules) {
    if (!canExecuteRule(rule, activeWorkflow)) continue;
    if (shouldSkipIdempotent(rule, ctx)) continue;
    if (!rule.matches(ctx)) continue;
    const action = rule.execute(ctx);
    if (action) actions.push(action);
  }
  return actions;
}

/** Build fingerprint + outcome patch after a deterministic tool runs. */
export function buildLastDeterministicActionPatch(
  ruleId: string,
  ctx: DeterministicActionContext,
  outcome: DeterministicActionOutcome
): Partial<AiState> {
  const rule = rules.find((r) => r.id === ruleId || r.id === ruleId.replace(/^det_/, ""));
  const fingerprint =
    rule?.fingerprint?.(ctx) ?? defaultFingerprint(ctx, ruleId);
  return {
    last_deterministic_action: {
      id: rule?.id ?? ruleId,
      fingerprint,
      outcome,
    },
  };
}

export function mapToolStatusToDeterministicOutcome(
  status: string | undefined
): DeterministicActionOutcome {
  if (status === "success") return "success";
  if (status === "not_found" || status === "unavailable") return "empty";
  return "blocked";
}

export function autoFocusSingleRescheduleAppointment(aiState: AiState): AiState {
  const flow = aiState.conversation_flow;
  if (!flow) return aiState;
  if (flow.current_operation?.status !== "active") return aiState;
  if (flow.active_workflow_id !== "reschedule") return aiState;
  if (!flow.pending.includes("reschedule_booking")) return aiState;
  if (aiState.focused_appointment_id?.trim()) return aiState;
  const active = (aiState.active_appointments ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (active.length !== 1) return aiState;
  return { ...aiState, focused_appointment_id: active[0] };
}

export function autoFocusSingleCheckInAppointment(aiState: AiState): AiState {
  const flow = aiState.conversation_flow;
  if (!flow) return aiState;
  if (flow.current_operation?.status !== "active") return aiState;
  if (flow.active_workflow_id !== "check_in") return aiState;
  if (!flow.pending.includes("check_in")) return aiState;
  if (aiState.focused_appointment_id?.trim()) return aiState;
  const active = (aiState.active_appointments ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (active.length !== 1) return aiState;
  return { ...aiState, focused_appointment_id: active[0] };
}
