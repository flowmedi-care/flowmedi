import { isScheduledAtInOfferedSlots } from "@/lib/booking-state";
import type { AiState } from "./types";

export function patchAiState(
  toolName: string,
  args: Record<string, unknown>,
  result: { status: string; data?: unknown },
  current: AiState
): Partial<AiState> {
  if (result.status !== "success") {
    return { consecutive_tool_failures: (current.consecutive_tool_failures ?? 0) + 1 };
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
    case "list_procedures":
    case "list_doctors": {
      if (args.procedure_id) {
        patch.booking = {
          ...current.booking,
          procedure_id: String(args.procedure_id),
          status: current.booking?.status ?? "collecting",
        };
      }
      if (args.doctor_id) {
        patch.booking = {
          ...(patch.booking ?? current.booking),
          doctor_id: String(args.doctor_id),
          status: patch.booking?.status ?? current.booking?.status ?? "collecting",
        };
      }
      break;
    }
    case "find_available_slots": {
      const mode = data.mode as string | undefined;
      const doctorId = String(args.doctor_id ?? current.booking?.doctor_id ?? "");
      const procedureId = String(args.procedure_id ?? current.booking?.procedure_id ?? "");
      const booking = {
        procedure_id: procedureId || current.booking?.procedure_id,
        doctor_id: doctorId || current.booking?.doctor_id,
        status: "collecting" as const,
        ...current.booking,
      };

      if (mode === "times" && Array.isArray(data.slots)) {
        const slots = (data.slots as Array<{ scheduled_at: string; display?: string; label?: string }>).map(
          (s) => ({
            scheduled_at: s.scheduled_at,
            display: s.display ?? s.label ?? s.scheduled_at,
          })
        );
        patch.booking = {
          ...booking,
          date: data.date ? String(data.date) : booking.date,
          offered_slots: slots,
          status: slots.length === 1 ? "confirming" : "collecting",
        };
      } else if (mode === "days") {
        patch.booking = {
          ...booking,
          offered_slots: undefined,
          status: "collecting",
        };
      }
      break;
    }
    case "create_appointment": {
      patch.booking = { status: "done" };
      break;
    }
    case "list_patient_appointments": {
      const appointments = data.appointments as Array<{ id?: string }> | undefined;
      if (Array.isArray(appointments)) {
        const ids = appointments.map((a) => a.id).filter(Boolean) as string[];
        patch.active_appointments = ids;
        if (ids.length === 1) patch.focused_appointment_id = ids[0];
      }
      break;
    }
    case "cancel_appointment":
    case "reschedule_appointment": {
      if (data.reschedule_flow) {
        patch.booking = {
          procedure_id: current.booking?.procedure_id,
          doctor_id: current.booking?.doctor_id,
          status: "collecting",
        };
        patch.focused_appointment_id = String(args.appointment_id ?? current.focused_appointment_id ?? "");
      } else {
        patch.focused_appointment_id = undefined;
      }
      break;
    }
    case "get_service_price":
    case "list_price_options": {
      if (args.procedure_id) {
        patch.booking = {
          ...current.booking,
          procedure_id: String(args.procedure_id),
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
  if (patch.booking !== undefined) {
    next.booking = patch.booking === undefined ? undefined : { ...current.booking, ...patch.booking } as AiState["booking"];
  }
  return next;
}

export function resolveScheduledAt(
  args: Record<string, unknown>,
  state: AiState
): string {
  return String(args.scheduled_at ?? state.booking?.pending_slot ?? "");
}

export function slotIsInOffered(state: AiState, scheduledAt: string): boolean {
  const slots = state.booking?.offered_slots ?? [];
  if (!slots.length) return Boolean(scheduledAt);
  return isScheduledAtInOfferedSlots(scheduledAt, slots);
}
