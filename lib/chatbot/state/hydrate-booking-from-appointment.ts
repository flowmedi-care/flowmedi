import type { AiState, BookingState } from "./types";

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

  return {
    focused_appointment_id: String(appointment.id),
    booking: {
      ...prev,
      status: "collecting",
      ...(doctorId ? { doctor_id: doctorId } : {}),
      ...(procedureId ? { procedure_id: procedureId } : {}),
    },
  };
}
