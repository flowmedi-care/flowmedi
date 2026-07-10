import { BOOKING_WEEKDAY_PATTERNS } from "@/lib/virtual-assistant/booking-slot-messages";

export function parseDateFromText(text: string, referenceYear = new Date().getFullYear()): string | null {
  const dm = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!dm) return null;
  const day = Number(dm[1]);
  const month = Number(dm[2]);
  const year = dm[3] ? Number(dm[3]) : referenceYear;
  const y = year < 100 ? 2000 + year : year;
  const d = new Date(y, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function weekdayFromText(text: string, referenceDate = new Date()): string | null {
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

export function extractDate(text: string, refDate = new Date()): string | null {
  return parseDateFromText(text, refDate.getFullYear()) ?? weekdayFromText(text, refDate);
}
