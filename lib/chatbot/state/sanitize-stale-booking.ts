import { getZonedYmd, DEFAULT_CLINIC_TIMEZONE } from "@/lib/clinic-timezone";
import type { AiState } from "./types";

/**
 * Clear draft schedule fields when booking.date is before today (clinic TZ).
 * Preserves doctor_id / procedure_id. Drops confirming / date / slots / pending_slot.
 */
export function sanitizeStaleBooking(
  aiState: AiState,
  now: Date = new Date(),
  clinicTimezone: string = DEFAULT_CLINIC_TIMEZONE
): AiState {
  const booking = aiState.booking;
  if (!booking?.date?.trim()) return aiState;

  const today = getZonedYmd(now, clinicTimezone);
  if (booking.date >= today) return aiState;

  return {
    ...aiState,
    booking: {
      doctor_id: booking.doctor_id,
      procedure_id: booking.procedure_id,
      // confirming no longer valid without a current date
      status: "collecting",
    },
  };
}
