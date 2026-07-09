import { BOOKING_WEEKDAY_PATTERNS } from "./booking-slot-messages";
import type { AiConversationState } from "./types";

function parseDateFromText(text: string): string | null {
  const dm = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    const year = dm[3] ? Number(dm[3]) : new Date().getFullYear();
    const y = year < 100 ? 2000 + year : year;
    const d = new Date(y, month - 1, day);
    if (!Number.isNaN(d.getTime())) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function weekdayFromText(text: string, referenceDate = new Date()): string | null {
  for (const { pattern, dayIndex } of BOOKING_WEEKDAY_PATTERNS) {
    if (!pattern.test(text)) continue;
    const ref = new Date(referenceDate);
    const currentDay = ref.getDay();
    let delta = dayIndex - currentDay;
    if (delta <= 0) delta += 7;
    ref.setDate(ref.getDate() + delta);
    const y = ref.getFullYear();
    const m = String(ref.getMonth() + 1).padStart(2, "0");
    const d = String(ref.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

/** Resolve data ISO a partir da mensagem, last_slot_query ou offered_days. */
export function resolveDayFromContext(
  messageText: string,
  aiState: AiConversationState,
  timeZone?: string
): string | null {
  const iso = parseDateFromText(messageText);
  if (iso) return iso;

  const fromWeekday = weekdayFromText(messageText);
  if (fromWeekday) {
    const offered = aiState.offered_days?.find((d) => d.date === fromWeekday);
    if (offered) return offered.date;
    return fromWeekday;
  }

  if (aiState.last_slot_query?.date) {
    return aiState.last_slot_query.date;
  }

  if (aiState.offered_days?.length === 1) {
    return aiState.offered_days[0]!.date;
  }

  void timeZone;
  return null;
}

export function hasBookingSlotContext(aiState: AiConversationState): boolean {
  return Boolean(
    aiState.procedure_id &&
      aiState.doctor_id &&
      (aiState.last_slot_query?.date ||
        (aiState.offered_days?.length ?? 0) > 0 ||
        (aiState.booking_step && aiState.booking_step !== "done"))
  );
}
