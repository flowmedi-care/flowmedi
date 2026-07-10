import type { PatientRef } from "../shared/patient-ref";
import type { AppointmentSlot } from "./appointment-slot";
import type { BookingMode, BookingStep } from "./booking-step";

export type BookingDraft = {
  step: BookingStep;
  mode: BookingMode;
  patientRef: PatientRef | null;
  serviceId: string | null;
  professionalId: string | null;
  slot: AppointmentSlot | null;
};

export function initialBookingDraft(mode: BookingMode = "create"): BookingDraft {
  return {
    step: "identify_patient",
    mode,
    patientRef: null,
    serviceId: null,
    professionalId: null,
    slot: null,
  };
}

export function canAdvanceBookingDraft(draft: BookingDraft): boolean {
  switch (draft.step) {
    case "identify_patient":
      return draft.patientRef !== null;
    case "select_service":
      return draft.serviceId !== null;
    case "select_professional":
      return draft.professionalId !== null;
    case "select_datetime":
      return draft.slot !== null;
    case "confirm":
      if (draft.mode === "cancel") return draft.patientRef !== null;
      return (
        draft.patientRef !== null &&
        draft.serviceId !== null &&
        draft.slot !== null
      );
    default:
      return false;
  }
}

export function patchBookingDraft(
  draft: BookingDraft,
  patch: Partial<BookingDraft>
): BookingDraft {
  return { ...draft, ...patch };
}
