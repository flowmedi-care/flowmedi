import { BOOKING_WEEKDAY_PATTERNS } from "@/lib/virtual-assistant/booking-slot-messages";
import {
  DEFAULT_CLINIC_TIMEZONE,
  addDaysToYmd,
  getZonedYmd,
} from "@/lib/clinic-timezone";

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

/**
 * Relative Portuguese dates in clinic timezone: hoje / amanhã / depois de amanhã / dia N.
 */
export function relativeDateFromText(
  text: string,
  refDate = new Date(),
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): string | null {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const today = getZonedYmd(refDate, timeZone);

  if (/\bdepois\s+de\s+amanha\b/.test(t)) {
    return addDaysToYmd(today, 2, timeZone);
  }
  if (/\bamanha\b/.test(t)) {
    return addDaysToYmd(today, 1, timeZone);
  }
  if (/\bhoje\b/.test(t)) {
    return today;
  }

  const diaM = t.match(/\bdia\s+(\d{1,2})\b/);
  if (diaM) {
    const day = Number(diaM[1]);
    if (day < 1 || day > 31) return null;
    const [yStr, mStr, dStr] = today.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const todayDay = Number(dStr);
    let year = y;
    let month = m;
    if (day < todayDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    const candidate = new Date(year, month - 1, day);
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/** True when text primarily signals a calendar date (not a clock choice). */
export function hasDateIntent(text: string): boolean {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(t)) return true;
  if (/\bdepois\s+de\s+amanha\b/.test(t) || /\bamanha\b/.test(t) || /\bhoje\b/.test(t)) {
    return true;
  }
  if (/\bdia\s+\d{1,2}\b/.test(t)) return true;
  for (const { pattern } of BOOKING_WEEKDAY_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function extractDate(
  text: string,
  refDate = new Date(),
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): string | null {
  return (
    parseDateFromText(text, refDate.getFullYear()) ??
    relativeDateFromText(text, refDate, timeZone) ??
    weekdayFromText(text, refDate)
  );
}
