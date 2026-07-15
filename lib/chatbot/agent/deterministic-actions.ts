import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "../state/types";
import { getValidOfferedSlots } from "../state/selection-context";

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

/**
 * Day/filters resolved + doctor/procedure ready + no valid slots → must fetch times.
 * Passes period only when present on this turn's facts or selection_context (not invent).
 */
export const daySelectedRule: DeterministicActionRule = {
  id: "day_selected",
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

/**
 * Cancelamento Current Operation in Selecting (needs appointment choice) → list.
 * Requires cancel_booking still pending so a completed-only workflow does not re-list.
 */
export const cancelNeedsListRule: DeterministicActionRule = {
  id: "cancel_needs_list",
  matches(ctx) {
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status === "completed") return false;
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
    if (flow?.current_operation?.status === "completed") return false;
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

/**
 * Confirmed pending slot during remarcação → reschedule_appointment (LLM out of the loop).
 */
export const rescheduleSlotConfirmedRule: DeterministicActionRule = {
  id: "reschedule_slot_confirmed",
  matches(ctx) {
    if (ctx.facts.confirmed !== true) return false;
    const flow = ctx.after.conversation_flow;
    if (flow?.current_operation?.status === "completed") return false;
    if (flow?.active_workflow_id !== "reschedule") return false;
    if (!flow.pending.includes("reschedule_booking")) return false;
    if (!ctx.after.focused_appointment_id?.trim()) return false;
    if (!ctx.after.booking?.pending_slot?.trim()) return false;
    // Stale pending after filter change must not mutate.
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

/** Declarative rules — only obligatory next tools, never conversation strategy. */
const rules: DeterministicActionRule[] = [
  daySelectedRule,
  cancelNeedsListRule,
  rescheduleNeedsListRule,
  rescheduleSlotConfirmedRule,
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

/**
 * Auto-focus the only active appointment during remarcação Selecting.
 * Safe heuristics: N===1 && !focus && workflow===reschedule && mutation pending.
 */
export function autoFocusSingleRescheduleAppointment(aiState: AiState): AiState {
  const flow = aiState.conversation_flow;
  if (!flow) return aiState;
  if (flow.current_operation?.status === "completed") return aiState;
  if (flow.active_workflow_id !== "reschedule") return aiState;
  if (!flow.pending.includes("reschedule_booking")) return aiState;
  if (aiState.focused_appointment_id?.trim()) return aiState;
  const active = (aiState.active_appointments ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (active.length !== 1) return aiState;
  return { ...aiState, focused_appointment_id: active[0] };
}
