/** Helpers de intervalo de agendamento (início/fim explícitos). */

import {
  assertScheduledInFuture as assertFuture,
  isScheduledInFuture,
  getZonedYmd,
  zonedLocalToUtcIso,
  DEFAULT_CLINIC_TIMEZONE,
} from "@/lib/clinic-timezone";

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

export { isScheduledInFuture };
export function assertScheduledInFuture(
  scheduledAt: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  return assertFuture(scheduledAt, now);
}
export function validateScheduledInFuture(
  scheduledAt: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  return assertFuture(scheduledAt, now);
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function validateScheduledInterval(
  scheduledAt: string,
  scheduledEndAt: string
): { ok: true } | { ok: false; error: string } {
  const start = new Date(scheduledAt).getTime();
  const end = new Date(scheduledEndAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: "Data ou horário inválido." };
  }
  if (end <= start) {
    return { ok: false, error: "O horário de término deve ser depois do início." };
  }
  const minutes = Math.round((end - start) / 60000);
  if (minutes > 24 * 60) {
    return { ok: false, error: "A consulta não pode durar mais de 24 horas." };
  }
  return { ok: true };
}

export function plannedDurationMinutes(
  scheduledAt: string,
  scheduledEndAt: string
): number {
  const start = new Date(scheduledAt).getTime();
  const end = new Date(scheduledEndAt).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

export function formatAppointmentTimeRange(
  scheduledAt: string,
  scheduledEndAt: string | null | undefined
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (!scheduledEndAt) return fmt(scheduledAt);
  return `${fmt(scheduledAt)}–${fmt(scheduledEndAt)}`;
}

export function formatConflictTimeRange(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(startMs)} às ${fmt(endMs)}`;
}

export function dayBoundsForScheduledAt(
  scheduledAt: string,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): {
  dayStart: string;
  dayEnd: string;
} {
  const ymd = getZonedYmd(new Date(scheduledAt), timeZone);
  const dayStart = zonedLocalToUtcIso(ymd, 0, 0, timeZone);
  // End of clinic-local day (23:59:59.999 approximated via next-day midnight - 1ms).
  const nextYmdParts = (() => {
    const noon = new Date(zonedLocalToUtcIso(ymd, 12, 0, timeZone));
    noon.setUTCDate(noon.getUTCDate() + 1);
    return getZonedYmd(noon, timeZone);
  })();
  const nextMidnight = new Date(zonedLocalToUtcIso(nextYmdParts, 0, 0, timeZone)).getTime();
  const dayEnd = new Date(nextMidnight - 1).toISOString();
  return { dayStart, dayEnd };
}

/** Monta ISO de término no mesmo dia local que o início. */
export function buildScheduledEndAt(
  dateYmd: string,
  endTimeHm: string,
  startIso?: string
): string {
  const local = new Date(`${dateYmd}T${endTimeHm}:00`);
  if (startIso) {
    const start = new Date(startIso);
    if (local.getTime() <= start.getTime()) {
      local.setDate(local.getDate() + 1);
    }
  }
  return local.toISOString();
}

export function buildScheduledEndFromDuration(
  scheduledAt: string,
  durationMinutes: number
): string {
  const start = new Date(scheduledAt).getTime();
  return new Date(start + durationMinutes * 60 * 1000).toISOString();
}

export function suggestDefaultEndTimeHm(
  startTimeHm: string,
  durationMinutes: number = DEFAULT_APPOINTMENT_DURATION_MINUTES
): string {
  const [h, m] = startTimeHm.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function resolveAppointmentEndMs(
  scheduledAt: string,
  scheduledEndAt: string | null | undefined,
  fallbackDurationMinutes: number = DEFAULT_APPOINTMENT_DURATION_MINUTES
): number {
  if (scheduledEndAt) return new Date(scheduledEndAt).getTime();
  return new Date(scheduledAt).getTime() + fallbackDurationMinutes * 60 * 1000;
}

export function shiftIntervalPreservingDuration(
  oldStartIso: string,
  oldEndIso: string | null | undefined,
  newStartIso: string,
  fallbackDurationMinutes: number = DEFAULT_APPOINTMENT_DURATION_MINUTES
): { scheduled_at: string; scheduled_end_at: string } {
  const oldStart = new Date(oldStartIso).getTime();
  const oldEnd = oldEndIso
    ? new Date(oldEndIso).getTime()
    : oldStart + fallbackDurationMinutes * 60 * 1000;
  const durationMs = oldEnd - oldStart;
  const newStart = new Date(newStartIso).getTime();
  return {
    scheduled_at: newStartIso,
    scheduled_end_at: new Date(newStart + durationMs).toISOString(),
  };
}
