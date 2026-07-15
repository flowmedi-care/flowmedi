import {
  DEFAULT_CLINIC_TIMEZONE,
  getZonedDateTimeParts,
} from "@/lib/clinic-timezone";
import type { OfferedSlot } from "../state/types";

export type PeriodHint = "manha" | "tarde" | "noite";

export type ClockPeriodIntent = {
  clockHour: number;
  clockMinutes: number;
  periodHint: PeriodHint | null;
};

function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes-of-day in clinic timezone — never use host Date.getHours(). */
function slotMinutesInClinicTz(
  iso: string,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = getZonedDateTimeParts(d, timeZone);
  const hour = parts.hour === 24 ? 0 : parts.hour;
  return hour * 60 + parts.minute;
}

/** Parse HH:MM or H from a short label (e.g. display "10:00"). */
export function parseClockLabel(text: string): number | null {
  const t = text.trim().toLowerCase();
  const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m2) {
    const h = Number(m2[1]);
    const min = Number(m2[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }
  const m1 = t.match(/^(\d{1,2})h?$/);
  if (m1) {
    const h = Number(m1[1]);
    if (h >= 0 && h <= 23) return h * 60;
  }
  return null;
}

function hasClockCue(t: string): boolean {
  return (
    /\b\d{1,2}:\d{2}\b/.test(t) ||
    /\b\d{1,2}\s*h\b/.test(t) ||
    /\b(?:as|às|umas?|pelas?)\s+\d{1,2}\b/.test(t) ||
    /\b(?:pode ser|quero|prefiro)\s+(?:as|às|umas?|pelas?)?\s*\d{1,2}\b/.test(t) ||
    /\b\d{1,2}\s+da\s+(?:manha|tarde|noite)\b/.test(t) ||
    /\bhorario\b/.test(t)
  );
}

/**
 * Etapa A: extract intermediate clock + optional period from free text.
 * Does not match slots yet.
 * Calendar phrases like "dia 16" without a clock cue do not yield a clock intent.
 */
export function extractClockPeriodIntent(
  text: string,
  periodFromFacts?: PeriodHint | null
): ClockPeriodIntent | null {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

  const diaOnly =
    /\bdia\s+\d{1,2}\b/.test(t) && !hasClockCue(t);
  if (diaOnly) return null;

  let periodHint: PeriodHint | null = periodFromFacts ?? null;
  if (/\bda\s+tarde\b/.test(t) || /\btarde\b/.test(t)) periodHint = "tarde";
  else if (/\bda\s+manha\b/.test(t) || /\bmanha\b/.test(t)) periodHint = "manha";
  else if (/\bda\s+noite\b/.test(t) || /\bnoite\b/.test(t)) periodHint = "noite";

  // Explicit 24h forms first: 16:00, 16h
  const explicit = t.match(/\b(\d{1,2}):(\d{2})\b/) ?? t.match(/\b(\d{1,2})\s*h\b/);
  if (explicit) {
    const h = Number(explicit[1]);
    const min = explicit[2] != null && explicit[0].includes(":") ? Number(explicit[2]) : 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      // 16:00 already 24h — ignore period shift for hours >= 13
      return { clockHour: h, clockMinutes: min, periodHint: h >= 13 ? null : periodHint };
    }
  }

  // Soft forms require an hour cue prefix (never bare "16" in "dia 16").
  const soft = t.match(
    /\b(?:as|às|umas?|pelas?|pode ser(?:\s+(?:as|às))?|quero|prefiro|horario)\s+(\d{1,2})(?::(\d{2}))?\b/
  ) ?? t.match(/\b(\d{1,2})\s+da\s+(?:manha|tarde|noite)\b/);
  if (soft) {
    const h = Number(soft[1]);
    const min = soft[2] != null ? Number(soft[2]) : 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return { clockHour: h, clockMinutes: min, periodHint };
    }
  }

  return null;
}

/**
 * Etapa B: clock + period → minutes-of-day in clinic-local terms.
 */
export function resolveLocalMinutes(intent: ClockPeriodIntent): number {
  let hour = intent.clockHour;
  const min = intent.clockMinutes;

  if (intent.periodHint === "tarde" && hour >= 1 && hour <= 11) {
    hour += 12;
  } else if (intent.periodHint === "noite" && hour >= 1 && hour <= 11) {
    hour += 12;
  } else if (intent.periodHint === "manha" && hour === 12) {
    hour = 12;
  }
  // period manha with 1–11: keep as-is

  return hour * 60 + min;
}

function matchSlotByLocalMinutes(
  offeredSlots: OfferedSlot[],
  minutes: number,
  timeZone: string
): { scheduled_at: string; selected_hour: string } | null {
  const selectedHour = formatHourLabel(minutes);

  // Prefer display (clinic-local labels) — never compare ISO strings.
  for (const slot of offeredSlots) {
    const display = (slot.display ?? "").trim();
    if (!display) continue;
    const displayMinutes = parseClockLabel(display);
    if (displayMinutes != null && displayMinutes === minutes) {
      return { scheduled_at: slot.scheduled_at, selected_hour: selectedHour };
    }
  }

  for (const slot of offeredSlots) {
    const sm = slotMinutesInClinicTz(slot.scheduled_at, timeZone);
    if (sm != null && sm === minutes) {
      return { scheduled_at: slot.scheduled_at, selected_hour: selectedHour };
    }
  }

  // Hour-only fallback (e.g. "16" → first 16:xx)
  const hourOnly = Math.floor(minutes / 60);
  for (const slot of offeredSlots) {
    const displayMinutes = parseClockLabel((slot.display ?? "").trim());
    if (displayMinutes != null && Math.floor(displayMinutes / 60) === hourOnly) {
      return {
        scheduled_at: slot.scheduled_at,
        selected_hour: formatHourLabel(displayMinutes),
      };
    }
    const sm = slotMinutesInClinicTz(slot.scheduled_at, timeZone);
    if (sm != null && Math.floor(sm / 60) === hourOnly) {
      return {
        scheduled_at: slot.scheduled_at,
        selected_hour: formatHourLabel(sm),
      };
    }
  }

  return null;
}

export type TimeChoiceResult = {
  scheduled_at: string;
  selected_hour: string;
};

export type TimeChoiceAttempt =
  | { ok: true; pick: TimeChoiceResult }
  | { ok: false; reason: "no_slots" | "no_clock" | "no_match"; resolvedHour?: string };

/**
 * Etapa A→B→C: extract clock+period, resolve local minutes, match by display / clinic-local.
 */
export function attemptTimeChoice(
  text: string,
  offeredSlots?: OfferedSlot[],
  opts?: {
    timeZone?: string;
    periodFromFacts?: PeriodHint | null;
  }
): TimeChoiceAttempt {
  if (!offeredSlots?.length) return { ok: false, reason: "no_slots" };

  const intent = extractClockPeriodIntent(text, opts?.periodFromFacts ?? null);
  if (!intent) return { ok: false, reason: "no_clock" };

  const minutes = resolveLocalMinutes(intent);
  const pick = matchSlotByLocalMinutes(
    offeredSlots,
    minutes,
    opts?.timeZone ?? DEFAULT_CLINIC_TIMEZONE
  );
  if (!pick) {
    return {
      ok: false,
      reason: "no_match",
      resolvedHour: formatHourLabel(minutes),
    };
  }
  return { ok: true, pick };
}

/** Match user time choice against offered slots (display / clinic-local only). */
export function extractTimeChoice(
  text: string,
  offeredSlots?: OfferedSlot[],
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): TimeChoiceResult | null {
  const attempt = attemptTimeChoice(text, offeredSlots, { timeZone });
  return attempt.ok ? attempt.pick : null;
}
