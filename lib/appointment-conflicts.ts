import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  dayBoundsForScheduledAt,
  formatConflictTimeRange,
  intervalsOverlap,
  buildScheduledEndFromDuration,
  resolveAppointmentEndMs,
} from "./appointment-scheduling";
import { checkScheduleBlockConflict } from "./schedule-blocks";
import {
  addDaysToYmd,
  DEFAULT_CLINIC_TIMEZONE,
  formatZonedDayLabel,
  formatZonedSlotLabel,
  formatZonedTimeLabel,
  getClinicTimezone,
  getZonedWeekday,
  getZonedYmd,
  zonedLocalToUtcIso,
} from "./clinic-timezone";

export async function clinicRequiresRoom(supabase: SupabaseClient, clinicId: string): Promise<boolean> {
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("active", true);
  return (count ?? 0) > 0;
}

async function getClinicAgendaMaxConcurrent(
  supabase: SupabaseClient,
  clinicId: string
): Promise<number | null> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("agenda_max_concurrent")
    .eq("id", clinicId)
    .single();
  const n = clinic?.agenda_max_concurrent;
  if (n == null || n < 2) return null;
  return n;
}

export async function checkAppointmentConflict(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    scheduledAt: string;
    scheduledEndAt: string;
    roomId?: string | null;
    excludeAppointmentId: string | null;
    timeZone?: string;
  }
): Promise<string | null> {
  const start = new Date(opts.scheduledAt).getTime();
  const end = new Date(opts.scheduledEndAt).getTime();
  const timeZone = opts.timeZone ?? DEFAULT_CLINIC_TIMEZONE;
  const { dayStart, dayEnd } = dayBoundsForScheduledAt(opts.scheduledAt, timeZone);

  const { data: doctor } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", opts.doctorId)
    .single();
  const doctorName = (doctor?.full_name as string | undefined)?.trim() || "este profissional";

  let doctorQuery = supabase
    .from("appointments")
    .select("id, scheduled_at, scheduled_end_at")
    .eq("clinic_id", opts.clinicId)
    .eq("doctor_id", opts.doctorId)
    .neq("status", "cancelada")
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (opts.excludeAppointmentId) {
    doctorQuery = doctorQuery.neq("id", opts.excludeAppointmentId);
  }

  const { data: doctorDayAppointments } = await doctorQuery;

  for (const appt of doctorDayAppointments ?? []) {
    const apptStart = new Date(appt.scheduled_at).getTime();
    const apptEnd = resolveAppointmentEndMs(
      appt.scheduled_at,
      appt.scheduled_end_at as string | null,
      DEFAULT_APPOINTMENT_DURATION_MINUTES
    );
    if (intervalsOverlap(start, end, apptStart, apptEnd)) {
      return `${doctorName} já tem consulta das ${formatConflictTimeRange(apptStart, apptEnd)}.`;
    }
  }

  if (opts.roomId) {
    const { data: room } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", opts.roomId)
      .single();
    const roomName = (room?.name as string | undefined)?.trim() || "esta sala";

    let roomQuery = supabase
      .from("appointments")
      .select("id, scheduled_at, scheduled_end_at")
      .eq("clinic_id", opts.clinicId)
      .eq("room_id", opts.roomId)
      .neq("status", "cancelada")
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (opts.excludeAppointmentId) {
      roomQuery = roomQuery.neq("id", opts.excludeAppointmentId);
    }

    const { data: roomDayAppointments } = await roomQuery;
    for (const appt of roomDayAppointments ?? []) {
      const apptStart = new Date(appt.scheduled_at).getTime();
      const apptEnd = resolveAppointmentEndMs(
        appt.scheduled_at,
        appt.scheduled_end_at as string | null,
        DEFAULT_APPOINTMENT_DURATION_MINUTES
      );
      if (intervalsOverlap(start, end, apptStart, apptEnd)) {
        return `${roomName} já está ocupada das ${formatConflictTimeRange(apptStart, apptEnd)}.`;
      }
    }
  } else {
    const hasRooms = await clinicRequiresRoom(supabase, opts.clinicId);
    if (!hasRooms) {
      const maxConcurrent = await getClinicAgendaMaxConcurrent(supabase, opts.clinicId);
      if (maxConcurrent) {
        let clinicQuery = supabase
          .from("appointments")
          .select("id, scheduled_at, scheduled_end_at")
          .eq("clinic_id", opts.clinicId)
          .neq("status", "cancelada")
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd);

        if (opts.excludeAppointmentId) {
          clinicQuery = clinicQuery.neq("id", opts.excludeAppointmentId);
        }

        const { data: clinicDayAppointments } = await clinicQuery;
        let overlapping = 0;
        for (const appt of clinicDayAppointments ?? []) {
          const apptStart = new Date(appt.scheduled_at).getTime();
          const apptEnd = resolveAppointmentEndMs(
            appt.scheduled_at,
            appt.scheduled_end_at as string | null,
            DEFAULT_APPOINTMENT_DURATION_MINUTES
          );
          if (intervalsOverlap(start, end, apptStart, apptEnd)) overlapping++;
        }
        if (overlapping >= maxConcurrent) {
          return `Limite de ${maxConcurrent} consultas simultâneas atingido neste horário.`;
        }
      }
    }
  }

  const blockConflict = await checkScheduleBlockConflict(supabase, {
    clinicId: opts.clinicId,
    doctorId: opts.doctorId,
    scheduledAt: opts.scheduledAt,
    scheduledEndAt: opts.scheduledEndAt,
    timeZone: opts.timeZone,
  });
  if (blockConflict) return blockConflict;

  return null;
}

export type AvailableSlot = {
  scheduled_at: string;
  scheduled_end_at: string;
  label: string;
};

export type AvailableDay = {
  date: string;
  label: string;
  periods: ("manha" | "tarde")[];
};

export type DaySlot = AvailableSlot & {
  available: boolean;
  reason?: "booked" | "past" | "lunch";
  period: SlotPeriod;
};

export type SlotPeriod = "manha" | "tarde";

type OperatingHoursMap = Record<
  string,
  { open?: string; close?: string; lunch_start?: string; lunch_end?: string; closed?: boolean }
>;

type DayOperatingConfig = {
  closed: boolean;
  openHm: string;
  closeHm: string;
  lunchStart: number | null;
  lunchEnd: number | null;
};

type SlotSearchContext = {
  clinicId: string;
  doctorId: string;
  durationMinutes: number;
  defaultStart: string;
  defaultEnd: string;
  operatingHours: OperatingHoursMap;
  timeZone: string;
  holidayPolicy: string | null;
};

const DAY_KEY_BY_JS: Record<number, string> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatDateIsoFromYmd(dateYmd: string): string {
  return dateYmd;
}

function isHolidayBlocked(dateYmd: string, holidayPolicy: string | null): boolean {
  if (!holidayPolicy?.trim()) return false;
  const [, mo, d] = dateYmd.split("-");
  const ddmm = `${d}/${mo}`;
  const full = `${d}/${mo}/${dateYmd.slice(0, 4)}`;
  return holidayPolicy.includes(ddmm) || holidayPolicy.includes(full);
}

function formatDayLabel(dateYmd: string, timeZone: string): string {
  return formatZonedDayLabel(dateYmd, timeZone);
}

function formatSlotLabel(iso: string, timeZone: string): string {
  return formatZonedSlotLabel(iso, timeZone);
}

function formatTimeLabel(iso: string, timeZone: string): string {
  return formatZonedTimeLabel(iso, timeZone);
}

async function loadSlotSearchContext(
  supabase: SupabaseClient,
  opts: { clinicId: string; doctorId: string; procedureId: string }
): Promise<SlotSearchContext> {
  const { data: procedure } = await supabase
    .from("procedures")
    .select("duration_minutes")
    .eq("id", opts.procedureId)
    .eq("clinic_id", opts.clinicId)
    .single();
  const durationMinutes = Number(procedure?.duration_minutes) || DEFAULT_APPOINTMENT_DURATION_MINUTES;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("agenda_work_start, agenda_work_end")
    .eq("id", opts.clinicId)
    .single();

  const defaultStart = String(clinic?.agenda_work_start ?? "07:00:00").slice(0, 5);
  const defaultEnd = String(clinic?.agenda_work_end ?? "20:00:00").slice(0, 5);

  const { data: vaSettings } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("operating_hours, holiday_policy")
    .eq("clinic_id", opts.clinicId)
    .maybeSingle();

  const operatingHours = (vaSettings?.operating_hours as OperatingHoursMap) ?? {};
  const timeZone = await getClinicTimezone(supabase, opts.clinicId);

  return {
    clinicId: opts.clinicId,
    doctorId: opts.doctorId,
    durationMinutes,
    defaultStart,
    defaultEnd,
    operatingHours,
    timeZone,
    holidayPolicy: (vaSettings?.holiday_policy as string | null) ?? null,
  };
}

function getDayOperatingConfig(ctx: SlotSearchContext, dateYmd: string): DayOperatingConfig | null {
  if (isHolidayBlocked(dateYmd, ctx.holidayPolicy)) return null;

  const dayKey = DAY_KEY_BY_JS[getZonedWeekday(dateYmd, ctx.timeZone)];
  const dayConfig = ctx.operatingHours[dayKey];

  if (dayConfig?.closed) return null;

  return {
    closed: false,
    openHm: dayConfig?.open ?? ctx.defaultStart,
    closeHm: dayConfig?.close ?? ctx.defaultEnd,
    lunchStart: dayConfig?.lunch_start ? parseHmToMinutes(dayConfig.lunch_start) : null,
    lunchEnd: dayConfig?.lunch_end ? parseHmToMinutes(dayConfig.lunch_end) : null,
  };
}

function getPeriodMinuteBounds(
  dayConfig: DayOperatingConfig,
  period?: SlotPeriod
): { startMinute: number; endMinute: number } {
  const openMinute = parseHmToMinutes(dayConfig.openHm);
  const closeMinute = parseHmToMinutes(dayConfig.closeHm);

  if (!period) {
    return { startMinute: openMinute, endMinute: closeMinute };
  }

  if (period === "manha") {
    const end = dayConfig.lunchStart ?? 12 * 60;
    return { startMinute: openMinute, endMinute: Math.min(end, closeMinute) };
  }

  const start = dayConfig.lunchEnd ?? 12 * 60;
  return { startMinute: Math.max(start, openMinute), endMinute: closeMinute };
}

function isMinuteInLunch(dayConfig: DayOperatingConfig, minute: number, durationMinutes: number): boolean {
  const { lunchStart, lunchEnd } = dayConfig;
  if (lunchStart == null || lunchEnd == null) return false;
  return minute < lunchEnd && minute + durationMinutes > lunchStart;
}

export type SlotScanStats = {
  date: string;
  generatedSlots: number;
  blockedSlotsDetected: number;
  removedSlots: string[];
  returnedDisplays: string[];
};

async function scanDaySlots(
  supabase: SupabaseClient,
  ctx: SlotSearchContext,
  dateYmd: string,
  dayConfig: DayOperatingConfig,
  opts: {
    slotStep: number;
    maxSlots: number;
    period?: SlotPeriod;
    timeOnlyLabel?: boolean;
    excludeAppointmentId?: string | null;
    /** When clinic requires rooms, only offer slots with at least one free room. */
    requireRoom?: boolean;
    stats?: SlotScanStats;
  }
): Promise<AvailableSlot[]> {
  const slots: AvailableSlot[] = [];
  const { startMinute, endMinute } = getPeriodMinuteBounds(dayConfig, opts.period);
  let minute = startMinute;
  const now = Date.now();

  while (minute + ctx.durationMinutes <= endMinute && slots.length < opts.maxSlots) {
    if (isMinuteInLunch(dayConfig, minute, ctx.durationMinutes)) {
      minute = dayConfig.lunchEnd!;
      continue;
    }

    const hour = Math.floor(minute / 60);
    const min = minute % 60;
    const scheduledAt = zonedLocalToUtcIso(dateYmd, hour, min, ctx.timeZone);
    const labelHm = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    if (opts.stats) opts.stats.generatedSlots += 1;

    if (new Date(scheduledAt).getTime() <= now) {
      minute += opts.slotStep;
      continue;
    }

    const scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, ctx.durationMinutes);

    const conflict = await checkAppointmentConflict(supabase, {
      clinicId: ctx.clinicId,
      doctorId: ctx.doctorId,
      scheduledAt,
      scheduledEndAt,
      excludeAppointmentId: opts.excludeAppointmentId ?? null,
      timeZone: ctx.timeZone,
    });

    if (!conflict) {
      if (opts.requireRoom) {
        const roomId = await findFirstAvailableRoom(supabase, {
          clinicId: ctx.clinicId,
          scheduledAt,
          scheduledEndAt,
        });
        if (!roomId) {
          if (opts.stats) {
            opts.stats.blockedSlotsDetected += 1;
            opts.stats.removedSlots.push(labelHm);
          }
          minute += opts.slotStep;
          continue;
        }
      }
      slots.push({
        scheduled_at: scheduledAt,
        scheduled_end_at: scheduledEndAt,
        label: opts.timeOnlyLabel
          ? formatTimeLabel(scheduledAt, ctx.timeZone)
          : formatSlotLabel(scheduledAt, ctx.timeZone),
      });
      if (opts.stats) {
        opts.stats.returnedDisplays.push(
          opts.timeOnlyLabel
            ? formatTimeLabel(scheduledAt, ctx.timeZone)
            : formatSlotLabel(scheduledAt, ctx.timeZone)
        );
      }
    } else if (opts.stats) {
      opts.stats.blockedSlotsDetected += 1;
      opts.stats.removedSlots.push(labelHm);
    }

    minute += opts.slotStep;
  }

  return slots;
}

function getSlotPeriod(dayConfig: DayOperatingConfig, minute: number): SlotPeriod {
  const lunchStart = dayConfig.lunchStart ?? 12 * 60;
  return minute < lunchStart ? "manha" : "tarde";
}

async function scanDaySlotGrid(
  supabase: SupabaseClient,
  ctx: SlotSearchContext,
  dateYmd: string,
  dayConfig: DayOperatingConfig,
  slotStep: number
): Promise<DaySlot[]> {
  const slots: DaySlot[] = [];
  const { startMinute, endMinute } = getPeriodMinuteBounds(dayConfig);
  let minute = startMinute;
  const now = Date.now();

  while (minute + ctx.durationMinutes <= endMinute) {
    const hour = Math.floor(minute / 60);
    const min = minute % 60;
    const scheduledAt = zonedLocalToUtcIso(dateYmd, hour, min, ctx.timeZone);
    const scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, ctx.durationMinutes);
    const period = getSlotPeriod(dayConfig, minute);

    let available = true;
    let reason: DaySlot["reason"];

    if (new Date(scheduledAt).getTime() <= now) {
      available = false;
      reason = "past";
    } else if (isMinuteInLunch(dayConfig, minute, ctx.durationMinutes)) {
      available = false;
      reason = "lunch";
    } else {
      const conflict = await checkAppointmentConflict(supabase, {
        clinicId: ctx.clinicId,
        doctorId: ctx.doctorId,
        scheduledAt,
        scheduledEndAt,
        excludeAppointmentId: null,
      });
      if (conflict) {
        available = false;
        reason = "booked";
      }
    }

    slots.push({
      scheduled_at: scheduledAt,
      scheduled_end_at: scheduledEndAt,
      label: formatTimeLabel(scheduledAt, ctx.timeZone),
      available,
      reason,
      period,
    });

    minute += slotStep;
  }

  return slots;
}

async function dayHasAvailability(
  supabase: SupabaseClient,
  ctx: SlotSearchContext,
  dateYmd: string,
  dayConfig: DayOperatingConfig
): Promise<SlotPeriod[]> {
  const periods: SlotPeriod[] = [];

  for (const period of ["manha", "tarde"] as SlotPeriod[]) {
    const slots = await scanDaySlots(supabase, ctx, dateYmd, dayConfig, {
      slotStep: 15,
      maxSlots: 1,
      period,
      timeOnlyLabel: true,
    });
    if (slots.length > 0) periods.push(period);
  }

  return periods;
}

export async function findFirstAvailableRoom(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    scheduledAt: string;
    scheduledEndAt: string;
    excludeAppointmentId?: string | null;
  }
): Promise<string | null> {
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("clinic_id", opts.clinicId)
    .eq("active", true);

  const start = new Date(opts.scheduledAt).getTime();
  const end = new Date(opts.scheduledEndAt).getTime();
  const { dayStart, dayEnd } = dayBoundsForScheduledAt(opts.scheduledAt, DEFAULT_CLINIC_TIMEZONE);

  for (const room of rooms ?? []) {
    let roomQuery = supabase
      .from("appointments")
      .select("id, scheduled_at, scheduled_end_at")
      .eq("clinic_id", opts.clinicId)
      .eq("room_id", room.id)
      .neq("status", "cancelada")
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (opts.excludeAppointmentId) {
      roomQuery = roomQuery.neq("id", opts.excludeAppointmentId);
    }

    const { data: roomDayAppointments } = await roomQuery;
    let hasConflict = false;
    for (const appt of roomDayAppointments ?? []) {
      const apptStart = new Date(appt.scheduled_at).getTime();
      const apptEnd = resolveAppointmentEndMs(
        appt.scheduled_at,
        appt.scheduled_end_at as string | null,
        DEFAULT_APPOINTMENT_DURATION_MINUTES
      );
      if (intervalsOverlap(start, end, apptStart, apptEnd)) {
        hasConflict = true;
        break;
      }
    }
    if (!hasConflict) return String(room.id);
  }

  return null;
}

export async function findAvailablePeriodsForDay(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    procedureId: string;
    date: string;
  }
): Promise<SlotPeriod[]> {
  const ctx = await loadSlotSearchContext(supabase, opts);
  const dayConfig = getDayOperatingConfig(ctx, opts.date);
  if (!dayConfig) return [];
  return dayHasAvailability(supabase, ctx, opts.date, dayConfig);
}

export function normalizeSlotPeriod(raw: unknown): SlotPeriod | undefined {
  const p = String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (p === "manha" || p === "morning") return "manha";
  if (p === "tarde" || p === "afternoon") return "tarde";
  return undefined;
}

export function formatSlotPeriodLabel(period: SlotPeriod): string {
  return period === "manha" ? "manhã" : "tarde";
}

export function formatPeriodsLabel(periods: SlotPeriod[]): string {
  if (periods.length === 2) return "manhã e tarde";
  if (periods[0] === "manha") return "manhã";
  return "tarde";
}

export function buildSlotsDisplayMessage(slots: AvailableSlot[]): string {
  return slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
}

export function buildDaysDisplayMessage(
  days: Array<{ label: string; periods_label: string }>
): string {
  return days.map((d, i) => `${i + 1}) ${d.label} — ${d.periods_label}`).join("\n");
}

export async function findAvailableDays(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    procedureId: string;
    fromDate?: Date;
    daysAhead?: number;
    maxDays?: number;
    skipDays?: number;
  }
): Promise<{ days: AvailableDay[]; hasMore: boolean }> {
  const daysAhead = opts.daysAhead ?? 14;
  const maxDays = opts.maxDays ?? 7;
  const skipDays = opts.skipDays ?? 0;

  const ctx = await loadSlotSearchContext(supabase, opts);
  const todayYmd = getZonedYmd(opts.fromDate ?? new Date(), ctx.timeZone);

  const days: AvailableDay[] = [];
  let skipped = 0;

  for (let day = 0; day < daysAhead; day++) {
    const dateYmd = addDaysToYmd(todayYmd, day, ctx.timeZone);
    const dayConfig = getDayOperatingConfig(ctx, dateYmd);
    if (!dayConfig) continue;

    const periods = await dayHasAvailability(supabase, ctx, dateYmd, dayConfig);
    if (periods.length === 0) continue;

    if (skipped < skipDays) {
      skipped++;
      continue;
    }

    days.push({
      date: formatDateIsoFromYmd(dateYmd),
      label: formatDayLabel(dateYmd, ctx.timeZone),
      periods,
    });

    if (days.length >= maxDays) {
      let hasMore = false;
      for (let remaining = day + 1; remaining < daysAhead; remaining++) {
        const nextYmd = addDaysToYmd(todayYmd, remaining, ctx.timeZone);
        const nextConfig = getDayOperatingConfig(ctx, nextYmd);
        if (!nextConfig) continue;
        const nextPeriods = await dayHasAvailability(supabase, ctx, nextYmd, nextConfig);
        if (nextPeriods.length > 0) {
          hasMore = true;
          break;
        }
      }
      return { days, hasMore };
    }
  }

  return { days, hasMore: false };
}

export async function findSlotsForDay(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    procedureId: string;
    date: string;
    period?: SlotPeriod;
    maxSlots?: number;
    slotStepMinutes?: number;
    excludeAppointmentId?: string | null;
    patientId?: string | null;
    onScanStats?: (stats: SlotScanStats) => void;
  }
): Promise<AvailableSlot[]> {
  const ctx = await loadSlotSearchContext(supabase, opts);
  const dayConfig = getDayOperatingConfig(ctx, opts.date);
  if (!dayConfig) return [];

  let excludeId = opts.excludeAppointmentId ?? null;
  if (!excludeId && opts.patientId) {
    const { data: patientAppts } = await supabase
      .from("appointments")
      .select("id, scheduled_at")
      .eq("clinic_id", opts.clinicId)
      .eq("patient_id", opts.patientId)
      .eq("doctor_id", opts.doctorId)
      .neq("status", "cancelada")
      .gte("scheduled_at", `${opts.date}T00:00:00`)
      .lte("scheduled_at", `${opts.date}T23:59:59`);
    if (patientAppts?.length === 1) {
      excludeId = patientAppts[0].id;
    }
  }

  const requireRoom = await clinicRequiresRoom(supabase, opts.clinicId);
  const slotStep = opts.slotStepMinutes ?? 30;
  const maxPerPeriod = opts.maxSlots ?? 6;
  const stats: SlotScanStats = {
    date: opts.date,
    generatedSlots: 0,
    blockedSlotsDetected: 0,
    removedSlots: [],
    returnedDisplays: [],
  };

  // No period filter: cover morning and afternoon separately so maxSlots
  // does not truncate to morning-only.
  if (!opts.period) {
    const manha = await scanDaySlots(supabase, ctx, opts.date, dayConfig, {
      slotStep,
      maxSlots: maxPerPeriod,
      period: "manha",
      timeOnlyLabel: true,
      excludeAppointmentId: excludeId,
      requireRoom,
      stats,
    });
    const tarde = await scanDaySlots(supabase, ctx, opts.date, dayConfig, {
      slotStep,
      maxSlots: maxPerPeriod,
      period: "tarde",
      timeOnlyLabel: true,
      excludeAppointmentId: excludeId,
      requireRoom,
      stats,
    });
    const combined = [...manha, ...tarde];
    if (opts.onScanStats) opts.onScanStats(stats);
    return combined;
  }

  const slots = await scanDaySlots(supabase, ctx, opts.date, dayConfig, {
    slotStep,
    maxSlots: maxPerPeriod,
    period: opts.period,
    timeOnlyLabel: true,
    excludeAppointmentId: excludeId,
    requireRoom,
    stats,
  });
  if (opts.onScanStats) opts.onScanStats(stats);
  return slots;
}

export async function findDaySlotGrid(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    procedureId: string;
    date: string;
    slotStepMinutes?: number;
  }
): Promise<{ date: string; periods: SlotPeriod[]; slots: DaySlot[] }> {
  const ctx = await loadSlotSearchContext(supabase, opts);
  const dayConfig = getDayOperatingConfig(ctx, opts.date);

  if (!dayConfig) {
    return { date: opts.date, periods: [], slots: [] };
  }

  const slotStep = opts.slotStepMinutes ?? 30;
  const slots = await scanDaySlotGrid(supabase, ctx, opts.date, dayConfig, slotStep);
  const periods = (["manha", "tarde"] as SlotPeriod[]).filter((p) =>
    slots.some((s) => s.period === p)
  );

  return { date: opts.date, periods, slots };
}

export async function findAvailableSlots(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    procedureId: string;
    fromDate?: Date;
    daysAhead?: number;
    maxSlots?: number;
    slotStepMinutes?: number;
  }
): Promise<AvailableSlot[]> {
  const daysAhead = opts.daysAhead ?? 14;
  const maxSlots = opts.maxSlots ?? 8;
  const slotStep = opts.slotStepMinutes ?? 15;

  const ctx = await loadSlotSearchContext(supabase, opts);
  const todayYmd = getZonedYmd(opts.fromDate ?? new Date(), ctx.timeZone);
  const slots: AvailableSlot[] = [];

  for (let day = 0; day < daysAhead && slots.length < maxSlots; day++) {
    const dateYmd = addDaysToYmd(todayYmd, day, ctx.timeZone);
    const dayConfig = getDayOperatingConfig(ctx, dateYmd);
    if (!dayConfig) continue;

    const daySlots = await scanDaySlots(supabase, ctx, dateYmd, dayConfig, {
      slotStep,
      maxSlots: maxSlots - slots.length,
    });
    slots.push(...daySlots);
  }

  return slots;
}

export async function resolveProcedureDurationMinutes(
  supabase: SupabaseClient,
  clinicId: string,
  procedureIds: string[]
): Promise<number> {
  if (!procedureIds.length) return DEFAULT_APPOINTMENT_DURATION_MINUTES;
  const { data } = await supabase
    .from("procedures")
    .select("duration_minutes")
    .in("id", procedureIds)
    .eq("clinic_id", clinicId);
  if (data?.length) {
    return Math.max(...data.map((p) => Number(p.duration_minutes) || 30));
  }
  return DEFAULT_APPOINTMENT_DURATION_MINUTES;
}
