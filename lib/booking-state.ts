import { getZonedYmd } from "@/lib/clinic-timezone";
import type { AiConversationState, OfferedDay, OfferedSlot } from "@/lib/virtual-assistant/types";

export function filterFreshOfferedDays(
  days: OfferedDay[],
  timeZone: string,
  now = new Date()
): OfferedDay[] {
  const todayYmd = getZonedYmd(now, timeZone);
  return days.filter((d) => d.date >= todayYmd);
}

export function filterFreshOfferedSlots(
  slots: OfferedSlot[],
  now = Date.now()
): OfferedSlot[] {
  return slots.filter((s) => new Date(s.scheduled_at).getTime() > now);
}

export function sanitizeOfferedBookingState(
  state: AiConversationState,
  timeZone: string,
  now = new Date()
): Partial<AiConversationState> {
  const offered_days = filterFreshOfferedDays(state.offered_days ?? [], timeZone, now);
  const offered_slots = filterFreshOfferedSlots(state.offered_slots ?? [], now.getTime());
  const patch: Partial<AiConversationState> = {};

  if ((state.offered_days?.length ?? 0) !== offered_days.length) {
    patch.offered_days = offered_days;
  }
  if ((state.offered_slots?.length ?? 0) !== offered_slots.length) {
    patch.offered_slots = offered_slots;
  }

  return patch;
}

export function isScheduledAtInOfferedSlots(
  scheduledAt: string,
  offeredSlots: OfferedSlot[]
): boolean {
  const target = new Date(scheduledAt).getTime();
  if (!Number.isFinite(target)) return false;
  return offeredSlots.some((s) => new Date(s.scheduled_at).getTime() === target);
}
