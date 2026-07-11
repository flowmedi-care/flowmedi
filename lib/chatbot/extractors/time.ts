import type { OfferedSlot } from "../state/types";

function parseHourFromText(text: string): number | null {
  const t = text.trim().toLowerCase();
  const m1 = t.match(/\b(?:às|as|pode ser|quero|prefiro|hor[aá]rio)?\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);
  if (m1) {
    const h = Number(m1[1]);
    const min = m1[2] != null ? Number(m1[2]) : 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }
  const m2 = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m2) {
    const h = Number(m2[1]);
    const min = Number(m2[2]);
    if (h >= 0 && h <= 23) return h * 60 + min;
  }
  return null;
}

function slotMinutesLocal(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Match user time choice ("13", "Pode ser 13", "13h") against offered slots. */
export function extractTimeChoice(
  text: string,
  offeredSlots?: OfferedSlot[]
): { scheduled_at: string; selected_hour: string } | null {
  if (!offeredSlots?.length) return null;

  const minutes = parseHourFromText(text);
  if (minutes == null) return null;

  for (const slot of offeredSlots) {
    const sm = slotMinutesLocal(slot.scheduled_at);
    if (sm != null && sm === minutes) {
      return { scheduled_at: slot.scheduled_at, selected_hour: formatHourLabel(minutes) };
    }
  }

  const hourOnly = Math.floor(minutes / 60);
  for (const slot of offeredSlots) {
    const sm = slotMinutesLocal(slot.scheduled_at);
    if (sm != null && Math.floor(sm / 60) === hourOnly) {
      return {
        scheduled_at: slot.scheduled_at,
        selected_hour: formatHourLabel(sm),
      };
    }
  }

  return null;
}
