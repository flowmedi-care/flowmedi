import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "../state/types";

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

export type DeterministicActionRule = {
  id: string;
  matches: (ctx: DeterministicActionContext) => boolean;
  execute: (ctx: DeterministicActionContext) => DeterministicAction | null;
};

/**
 * Day just resolved + doctor/procedure ready + no slots yet → must fetch times.
 * Does not invent period — let the tool return all available slots for the day.
 */
export const daySelectedRule: DeterministicActionRule = {
  id: "day_selected",
  matches(ctx) {
    const date = ctx.after.booking?.date?.trim();
    if (!date) return false;
    const dateJustSet = ctx.before.booking?.date !== date;
    if (!dateJustSet) return false;
    if (!ctx.after.booking?.doctor_id || !ctx.after.booking?.procedure_id) return false;
    if ((ctx.after.booking.offered_slots?.length ?? 0) > 0) return false;
    return true;
  },
  execute(ctx) {
    const date = ctx.after.booking?.date?.trim();
    if (!date) return null;
    return {
      toolName: "find_available_slots",
      args: {
        date,
        doctor_id: ctx.after.booking?.doctor_id,
        procedure_id: ctx.after.booking?.procedure_id,
      },
      reason: "day_selected",
    };
  },
};

/**
 * Cancelamento Current Operation in Selecting (needs appointment choice) → list.
 * Requires cancel_booking still pending so a completed-only workflow does not re-list.
 */
export const cancelNeedsListRule: DeterministicActionRule = {
  id: "cancel_needs_list",
  matches(ctx) {
    const flow = ctx.after.conversation_flow;
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

/**
 * Remarcação Current Operation in Selecting → list (parity with cancel).
 */
export const rescheduleNeedsListRule: DeterministicActionRule = {
  id: "reschedule_needs_list",
  matches(ctx) {
    const flow = ctx.after.conversation_flow;
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

/** Declarative rules — only obligatory next tools, never conversation strategy. */
const rules: DeterministicActionRule[] = [
  daySelectedRule,
  cancelNeedsListRule,
  rescheduleNeedsListRule,
  // doctorSelectedRule / procedureSelectedRule / slotConfirmedRule: add when transition is inevitable
];

/**
 * Given state before/after fact resolution: is there a tool that must run without the LLM?
 */
export function resolveDeterministicActions(
  ctx: DeterministicActionContext
): DeterministicAction[] {
  const actions: DeterministicAction[] = [];
  for (const rule of rules) {
    if (!rule.matches(ctx)) continue;
    const action = rule.execute(ctx);
    if (action) actions.push(action);
  }
  return actions;
}
