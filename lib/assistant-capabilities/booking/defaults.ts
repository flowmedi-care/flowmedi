import type { BookingSettings } from "./types";

export function bookingDefaults(): BookingSettings {
  return {
    allowBooking: true,
    allowReschedule: true,
    allowCancellation: true,
    mode: "assisted",
    patientInformation: {
      patient: "required",
      cpf: "optional",
      email: "optional",
      guardian: "optional",
    },
    appointmentInformation: {
      doctor: "required",
      procedure: "required",
      schedule: "required",
    },
    cancellationInformation: {
      reason: "optional",
    },
  };
}
