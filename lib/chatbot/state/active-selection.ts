import type { AiState, ActiveSelection, ActiveSelectionType, OfferedOption } from "./types";
import { getValidOfferedSlots } from "./selection-context";

/** Draft menu prepared by tools; becomes authoritative only after outbound commit. */
export type PendingActiveSelection = ActiveSelection;

export function optionsFromDoctors(
  doctors: AiState["offered_doctors"]
): ActiveSelection["options"] {
  return (doctors ?? []).map((d, i) => ({
    id: d.id,
    label: d.name,
    index: d.index ?? i + 1,
  }));
}

export function optionsFromProcedures(
  procedures: AiState["offered_procedures"]
): ActiveSelection["options"] {
  return (procedures ?? []).map((p, i) => ({
    id: p.id,
    label: p.name,
    index: p.index ?? i + 1,
  }));
}

export function optionsFromDays(days: AiState["offered_days"]): ActiveSelection["options"] {
  return (days ?? []).map((d, i) => ({
    id: d.date,
    label: d.label,
    index: d.index ?? i + 1,
  }));
}

export function optionsFromSlots(
  booking: AiState["booking"]
): ActiveSelection["options"] {
  return getValidOfferedSlots(booking).map((s, i) => ({
    id: s.scheduled_at,
    label: s.display,
    index: i + 1,
  }));
}

export function optionsFromAppointments(
  ids: string[] | undefined
): ActiveSelection["options"] {
  return (ids ?? []).map((id, i) => ({
    id,
    label: id,
    index: i + 1,
  }));
}

/** Prepare draft selection for a newly presented menu (in-memory / statePatch). */
export function preparePendingActiveSelection(
  type: ActiveSelectionType,
  options: ActiveSelection["options"]
): PendingActiveSelection {
  return {
    type,
    options: options.map((o, i) => ({
      id: o.id,
      label: o.label,
      index: o.index ?? i + 1,
    })),
  };
}

/**
 * Legacy / mid-migration: if no committed active_selection, derive the most specific
 * interactive menu still present so index resolution does not walk competing lists.
 */
export function deriveActiveSelection(state: AiState): ActiveSelection | undefined {
  if (state.active_selection?.options?.length) {
    return state.active_selection;
  }

  const slots = optionsFromSlots(state.booking);
  if (slots.length > 0) {
    return { type: "slot", options: slots };
  }
  const days = optionsFromDays(state.offered_days);
  if (days.length > 0) {
    return { type: "day", options: days };
  }
  if (!state.booking?.procedure_id) {
    const procedures = optionsFromProcedures(state.offered_procedures);
    if (procedures.length > 0) {
      return { type: "procedure", options: procedures };
    }
  }
  if (!state.booking?.doctor_id) {
    const doctors = optionsFromDoctors(state.offered_doctors);
    if (doctors.length > 0) {
      return { type: "doctor", options: doctors };
    }
  }
  const appts = optionsFromAppointments(state.active_appointments);
  if (appts.length > 0) {
    return { type: "appointment", options: appts };
  }
  return undefined;
}

export function resolveActiveOptionByIndex(
  selection: ActiveSelection | undefined,
  selectedIndex: number
): OfferedOption | null {
  if (!selection?.options?.length) return null;
  const byField = selection.options.find((o) => o.index === selectedIndex);
  const pick = byField ?? selection.options[selectedIndex - 1];
  if (!pick) return null;
  return { id: pick.id, name: pick.label, index: pick.index };
}

/**
 * Promote pending → active after outbound success.
 * Clears competing menus so only the last received menu remains.
 */
export function commitPendingActiveSelection(state: AiState, committedAt?: string): AiState {
  const pending = state.pending_active_selection;
  if (!pending?.options?.length) {
    return state;
  }

  const active: ActiveSelection = {
    ...pending,
    created_at: committedAt ?? new Date().toISOString(),
  };

  const next: AiState = {
    ...state,
    active_selection: active,
    pending_active_selection: undefined,
  };

  // Keep only the source menu that matches the committed type; drop competitors.
  switch (active.type) {
    case "doctor":
      next.offered_doctors = active.options.map((o) => ({
        id: o.id,
        name: o.label,
        index: o.index,
      }));
      next.offered_procedures = undefined;
      next.offered_days = undefined;
      break;
    case "procedure":
      next.offered_procedures = active.options.map((o) => ({
        id: o.id,
        name: o.label,
        index: o.index,
      }));
      next.offered_doctors = undefined;
      next.offered_days = undefined;
      break;
    case "day":
      next.offered_days = active.options.map((o) => ({
        date: o.id,
        label: o.label,
        index: o.index,
      }));
      next.offered_doctors = undefined;
      next.offered_procedures = undefined;
      if (next.booking) {
        next.booking = {
          ...next.booking,
          offered_slots: undefined,
          pending_slot: undefined,
          selection_epoch: undefined,
        };
      }
      break;
    case "slot":
      next.offered_days = undefined;
      next.offered_doctors = undefined;
      next.offered_procedures = undefined;
      break;
    case "appointment":
      next.offered_doctors = undefined;
      next.offered_procedures = undefined;
      next.offered_days = undefined;
      break;
    default:
      break;
  }

  return next;
}

/** Drop draft if outbound failed — do not leave sticky unreceived menu. */
export function discardPendingActiveSelection(state: AiState): AiState {
  if (!state.pending_active_selection) return state;
  const { pending_active_selection: _drop, ...rest } = state;
  return rest;
}
