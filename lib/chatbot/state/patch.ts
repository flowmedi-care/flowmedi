import { isScheduledAtInOfferedSlots } from "@/lib/booking-state";
import type { NormalizedFacts } from "../extractors/types";
import { isRecoverableToolStatus } from "../tools/types";
import type { ToolResult } from "../tools/types";
import type { AiState, OfferedOption } from "./types";
import type { MutationOutcome } from "../tools/mutation-result";
import { shouldIncrementToolFailures } from "../tools/mutation-result";
import { outcomeFromToolResult } from "../tools/error-class";
import { resolveBookingEntityId } from "./resolve-entity-id";
import { focusedAfterAppointmentListRefresh } from "./resolve-cancel-appointment-id";
import {
  preparePendingActiveSelection,
  optionsFromAppointments,
} from "./active-selection";
import {
  stampOfferedSlots,
  withSelectionFilters,
} from "./selection-context";

export function patchAiState(
  toolName: string,
  args: Record<string, unknown>,
  result: ToolResult,
  current: AiState,
  outcomeOverride?: MutationOutcome
): Partial<AiState> {
  const outcome = outcomeOverride ?? outcomeFromToolResult(result);
  if (shouldIncrementToolFailures(outcome)) {
    return {
      consecutive_tool_failures: (current.consecutive_tool_failures ?? 0) + 1,
    };
  }

  if (!isRecoverableToolStatus(result.status) && outcome !== "success") {
    if (outcome === "recoverable" || outcome === "business") {
      return { consecutive_tool_failures: 0 };
    }
  }

  if (outcome !== "success" && result.status === "error") {
    if (outcome === "recoverable" || outcome === "business") {
      return { consecutive_tool_failures: 0 };
    }
  }

  const data = (result.data ?? {}) as Record<string, unknown>;
  const patch: Partial<AiState> = { consecutive_tool_failures: 0 };

  switch (toolName) {
    case "lookup_patient_by_phone": {
      const patientId = data.patient_id ?? data.id;
      if (patientId) patch.patient_id = String(patientId);
      break;
    }
    case "register_patient": {
      const patientId = data.patientId ?? data.patient_id;
      if (patientId) patch.patient_id = String(patientId);
      break;
    }
    case "list_procedures": {
      if (Array.isArray(data.procedures)) {
        const procedures = data.procedures as Array<{ id: string; name: string }>;
        patch.offered_procedures = procedures.map((p, i) => ({
          id: p.id,
          name: p.name,
          index: i + 1,
        }));
        patch.pending_active_selection = preparePendingActiveSelection(
          "procedure",
          patch.offered_procedures.map((p) => ({
            id: p.id,
            label: p.name,
            index: p.index ?? 0,
          }))
        );
      }
      const procedureId = resolveBookingEntityId({
        arg: args.procedure_id,
        stateId: current.booking?.procedure_id,
        offered: patch.offered_procedures ?? current.offered_procedures,
        rejectId: current.patient_id,
      });
      const doctorId = resolveBookingEntityId({
        arg: args.doctor_id,
        stateId: current.booking?.doctor_id,
        offered: current.offered_doctors,
        rejectId: current.patient_id,
      });
      if (procedureId || doctorId) {
        patch.booking = withSelectionFilters(current.booking, {
          ...(procedureId ? { procedure_id: procedureId } : {}),
          ...(doctorId ? { doctor_id: doctorId } : {}),
        });
      }
      break;
    }
    case "list_doctors": {
      if (Array.isArray(data.doctors)) {
        const doctors = data.doctors as Array<{ id: string; full_name: string }>;
        patch.offered_doctors = doctors.map((d, i) => ({
          id: d.id,
          name: d.full_name,
          index: i + 1,
        }));
        patch.pending_active_selection = preparePendingActiveSelection(
          "doctor",
          patch.offered_doctors.map((d) => ({
            id: d.id,
            label: d.name,
            index: d.index ?? 0,
          }))
        );
      }
      const doctorId = resolveBookingEntityId({
        arg: args.doctor_id,
        stateId: current.booking?.doctor_id,
        offered: patch.offered_doctors ?? current.offered_doctors,
        rejectId: current.patient_id,
      });
      if (doctorId) {
        patch.booking = withSelectionFilters(current.booking, {
          doctor_id: doctorId,
        });
      }
      break;
    }
    case "find_available_slots": {
      const mode = data.mode as string | undefined;
      const doctorId = resolveBookingEntityId({
        arg: args.doctor_id,
        stateId: current.booking?.doctor_id,
        offered: current.offered_doctors,
        rejectId: current.patient_id,
      });
      const procedureId = resolveBookingEntityId({
        arg: args.procedure_id,
        stateId: current.booking?.procedure_id,
        offered: current.offered_procedures,
        rejectId: current.patient_id,
      });
      const periodRaw = data.period ?? args.period;
      const periodNorm =
        periodRaw === "manha" || periodRaw === "tarde" ? periodRaw : null;

      if (mode === "times" && Array.isArray(data.slots)) {
        const slots = (data.slots as Array<{ scheduled_at: string; display?: string; label?: string }>).map(
          (s) => ({
            scheduled_at: s.scheduled_at,
            display: s.display ?? s.label ?? s.scheduled_at,
          })
        );
        const date = data.date ? String(data.date) : current.booking?.date;
        patch.booking = stampOfferedSlots(
          current.booking,
          slots,
          {
            doctor_id: doctorId,
            procedure_id: procedureId,
            date,
            period: periodNorm,
          },
          { pendingIfSingle: true }
        );
        // New interactive menu = slots; clear day menu so indices cannot steal.
        patch.offered_days = undefined;
        patch.pending_active_selection = preparePendingActiveSelection(
          "slot",
          slots.map((s, i) => ({
            id: s.scheduled_at,
            label: s.display,
            index: i + 1,
          }))
        );
      } else if (mode === "days") {
        patch.booking = withSelectionFilters(current.booking, {
          ...(procedureId ? { procedure_id: procedureId } : {}),
          ...(doctorId ? { doctor_id: doctorId } : {}),
          period: null,
        });
        if (Array.isArray(data.days)) {
          const days = data.days as Array<{ date: string; label: string }>;
          patch.offered_days = days.map((d, i) => ({
            date: d.date,
            label: d.label,
            index: i + 1,
          }));
          patch.pending_active_selection = preparePendingActiveSelection(
            "day",
            patch.offered_days.map((d) => ({
              id: d.date,
              label: d.label,
              index: d.index ?? 0,
            }))
          );
        }
      }
      break;
    }
    case "create_appointment": {
      patch.booking = { status: "done" };
      patch.offered_doctors = undefined;
      patch.offered_procedures = undefined;
      patch.offered_days = undefined;
      patch.active_selection = undefined;
      patch.pending_active_selection = undefined;
      if (data.appointment_id) {
        const id = String(data.appointment_id);
        patch.focused_appointment_id = id;
        patch.active_appointments = [id];
      }
      break;
    }
    case "list_patient_appointments": {
      const appointments = data.appointments as Array<{ id?: string }> | undefined;
      if (Array.isArray(appointments)) {
        const ids = appointments.map((a) => a.id).filter(Boolean) as string[];
        patch.active_appointments = ids;
        // Refresh invariant: do not invalidate focus still present in the new list.
        patch.focused_appointment_id = focusedAfterAppointmentListRefresh(
          ids,
          current.focused_appointment_id
        );
        if (ids.length > 0) {
          patch.pending_active_selection = preparePendingActiveSelection(
            "appointment",
            optionsFromAppointments(ids)
          );
        }
      }
      break;
    }
    case "cancel_appointment": {
      if (outcome === "success" || data.cancelled) {
        patch.focused_appointment_id = undefined;
      }
      break;
    }
    case "reschedule_appointment": {
      if (data.reschedule_flow) {
        patch.booking = {
          procedure_id: current.booking?.procedure_id,
          doctor_id: current.booking?.doctor_id,
          status: "collecting",
        };
        patch.focused_appointment_id = String(
          args.appointment_id ?? current.focused_appointment_id ?? ""
        );
      } else if (data.rescheduled || outcome === "success") {
        // Success patch from execute owns focus + clearing draft; do not wipe focus.
        if (data.appointment_id) {
          patch.focused_appointment_id = String(data.appointment_id);
        }
      } else {
        patch.focused_appointment_id = undefined;
      }
      break;
    }
    case "perform_check_in": {
      if (outcome === "success" || data.checked_in) {
        const id = data.appointment_id ? String(data.appointment_id) : undefined;
        if (id) {
          patch.focused_appointment_id = id;
          patch.active_appointments = [id];
        }
      }
      break;
    }
    case "get_service_price": {
      const procedureId = resolveBookingEntityId({
        arg: args.procedure_id,
        stateId: current.booking?.procedure_id,
        offered: current.offered_procedures,
        rejectId: current.patient_id,
      });
      if (procedureId) {
        patch.booking = {
          ...current.booking,
          procedure_id: procedureId,
          status: current.booking?.status ?? "collecting",
        };
      }
      break;
    }
    default:
      break;
  }

  return patch;
}

export function mergeAiState(current: AiState, patch: Partial<AiState>): AiState {
  const next: AiState = { ...current, ...patch };
  if ("booking" in patch) {
    next.booking =
      patch.booking === undefined
        ? undefined
        : ({ ...current.booking, ...patch.booking } as AiState["booking"]);
  }
  if (patch.conversation_flow !== undefined) {
    next.conversation_flow =
      patch.conversation_flow === undefined
        ? undefined
        : ({
            ...current.conversation_flow,
            ...patch.conversation_flow,
            collected: {
              ...(current.conversation_flow?.collected ?? {}),
              ...(patch.conversation_flow.collected ?? {}),
            },
          } as AiState["conversation_flow"]);
  }
  return next;
}

export function resolveScheduledAt(
  args: Record<string, unknown>,
  state: AiState
): string {
  return resolveCreateAppointmentScheduledAt(args, state);
}

function isScheduledInOffered(state: AiState, scheduledAt: string): boolean {
  const slots = state.booking?.offered_slots ?? [];
  if (!slots.length) return Boolean(scheduledAt);
  return isScheduledAtInOfferedSlots(scheduledAt, slots);
}

/**
 * Prefer pending_slot when patient confirmed or LLM scheduled_at is not in offered_slots.
 */
export function resolveCreateAppointmentScheduledAt(
  args: Record<string, unknown>,
  state: AiState,
  facts?: Pick<NormalizedFacts, "confirmed">
): string {
  const pending = state.booking?.pending_slot?.trim() ?? "";
  const fromArgs =
    args.scheduled_at != null && String(args.scheduled_at).trim() !== ""
      ? String(args.scheduled_at).trim()
      : args.new_scheduled_at != null && String(args.new_scheduled_at).trim() !== ""
        ? String(args.new_scheduled_at).trim()
        : "";

  const pendingValid = pending !== "" && isScheduledInOffered(state, pending);
  const argsValid = fromArgs !== "" && isScheduledInOffered(state, fromArgs);

  if (facts?.confirmed === true && pendingValid) {
    return pending;
  }
  if (fromArgs && argsValid) {
    return fromArgs;
  }
  if (pendingValid) {
    return pending;
  }
  return pending || fromArgs;
}

export function slotIsInOffered(state: AiState, scheduledAt: string): boolean {
  const slots = state.booking?.offered_slots ?? [];
  if (!slots.length) return Boolean(scheduledAt);
  return isScheduledAtInOfferedSlots(scheduledAt, slots);
}

export function resolveOptionByIndex(
  options: OfferedOption[] | undefined,
  text: string
): OfferedOption | null {
  if (!options?.length) return null;
  const trimmed = text.trim();
  const numMatch = trimmed.match(/^\d{1,2}$/);
  if (!numMatch) return null;
  const index = Number(numMatch[0]);
  const byField = options.find((o) => o.index === index);
  if (byField) return byField;
  const byPosition = options[index - 1];
  return byPosition ?? null;
}
