import type { AiState, BookingState } from "./types";
import { withSelectionFilters } from "./selection-context";

/** Minimal appointment row fields needed to continue remarcação / confirmação. */
export type AppointmentHydrateSource = {
  id: string;
  doctor_id?: string | null;
  procedure_id?: string | null;
  duration_minutes?: number | null;
};

/**
 * Appointment → Conversation State patch (doctor/procedure/focus).
 * Does not call tools — used after focus is known so find_available_slots can run.
 * Filter changes invalidate offered_slots / pending via selection_context.
 */
export function hydrateBookingFromAppointment(
  appointment: AppointmentHydrateSource,
  current?: AiState
): Pick<AiState, "focused_appointment_id" | "booking"> {
  const prev: BookingState = current?.booking ?? { status: "collecting" };
  const doctorId = appointment.doctor_id ? String(appointment.doctor_id) : prev.doctor_id;
  const procedureId = appointment.procedure_id
    ? String(appointment.procedure_id)
    : prev.procedure_id;
  const duration =
    appointment.duration_minutes != null
      ? Number(appointment.duration_minutes)
      : prev.selection_context?.duration_minutes;

  const booking = withSelectionFilters(prev, {
    ...(doctorId ? { doctor_id: doctorId } : {}),
    ...(procedureId ? { procedure_id: procedureId } : {}),
    ...(duration !== undefined ? { duration_minutes: duration } : {}),
  });

  return {
    focused_appointment_id: String(appointment.id),
    booking: {
      ...booking,
      status: "collecting",
    },
  };
}
