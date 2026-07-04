import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_CLINIC_TIMEZONE = "America/Sao_Paulo";

export function isValidTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export async function getClinicTimezone(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string> {
  const { data } = await supabase
    .from("clinics")
    .select("auto_message_timezone")
    .eq("id", clinicId)
    .maybeSingle();
  const tz = data?.auto_message_timezone;
  if (typeof tz === "string" && tz.trim() && isValidTimezone(tz)) return tz;
  return DEFAULT_CLINIC_TIMEZONE;
}

export type ZonedDateTimeParts = {
  ymd: string;
  hour: number;
  minute: number;
};

export function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { ymd: `${y}-${mo}-${d}`, hour, minute };
}

export function getZonedYmd(now: Date, timeZone: string): string {
  return getZonedDateTimeParts(now, timeZone).ymd;
}

/** Converte data/hora local da clínica para ISO UTC. */
export function zonedLocalToUtcIso(
  dateYmd: string,
  hour: number,
  minute: number,
  timeZone: string
): string {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  let guess = Date.UTC(y, mo - 1, d, hour, minute, 0);

  for (let i = 0; i < 6; i++) {
    const parts = getZonedDateTimeParts(new Date(guess), timeZone);
    if (parts.ymd === dateYmd && parts.hour === hour && parts.minute === minute) {
      return new Date(guess).toISOString();
    }

    const targetMinutes = hour * 60 + minute;
    const guessMinutes = parts.hour * 60 + parts.minute;
    let dayDiff = 0;
    if (parts.ymd < dateYmd) dayDiff = 1;
    else if (parts.ymd > dateYmd) dayDiff = -1;
    const diffMinutes = dayDiff * 24 * 60 + (targetMinutes - guessMinutes);
    guess += diffMinutes * 60 * 1000;
  }

  return new Date(guess).toISOString();
}

export function addDaysToYmd(dateYmd: string, days: number, timeZone: string): string {
  const base = zonedLocalToUtcIso(dateYmd, 12, 0, timeZone);
  const next = new Date(new Date(base).getTime() + days * 24 * 60 * 60 * 1000);
  return getZonedYmd(next, timeZone);
}

export function formatZonedDayLabel(dateYmd: string, timeZone: string): string {
  const utc = zonedLocalToUtcIso(dateYmd, 12, 0, timeZone);
  const d = new Date(utc);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone });
  return `${weekday} ${date}`;
}

export function formatZonedSlotLabel(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${weekday} ${date} às ${time}`;
}

export function formatZonedTimeLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function getHourInTimezone(iso: string, timeZone: string): number {
  return getZonedDateTimeParts(new Date(iso), timeZone).hour;
}

export function getZonedWeekday(dateYmd: string, timeZone: string): number {
  const utc = zonedLocalToUtcIso(dateYmd, 12, 0, timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const wd = formatter.format(new Date(utc)).slice(0, 3);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

export function isScheduledInFuture(scheduledAt: string, now = Date.now()): boolean {
  const t = new Date(scheduledAt).getTime();
  return Number.isFinite(t) && t > now;
}

export function assertScheduledInFuture(
  scheduledAt: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  if (!isScheduledInFuture(scheduledAt, now)) {
    return { ok: false, error: "Esse horário já passou. Escolha um horário futuro." };
  }
  return { ok: true };
}
