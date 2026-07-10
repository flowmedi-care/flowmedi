export type BookingStep =
  | "identify_patient"
  | "select_service"
  | "select_professional"
  | "select_datetime"
  | "confirm";

export type BookingMode = "create" | "reschedule" | "cancel";

export const BOOKING_STEPS: BookingStep[] = [
  "identify_patient",
  "select_service",
  "select_professional",
  "select_datetime",
  "confirm",
];

export function nextBookingStep(step: BookingStep): BookingStep | null {
  const index = BOOKING_STEPS.indexOf(step);
  if (index < 0 || index >= BOOKING_STEPS.length - 1) return null;
  return BOOKING_STEPS[index + 1] ?? null;
}
