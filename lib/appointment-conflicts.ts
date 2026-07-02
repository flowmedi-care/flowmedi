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
  }
): Promise<string | null> {
  const start = new Date(opts.scheduledAt).getTime();
  const end = new Date(opts.scheduledEndAt).getTime();
  const { dayStart, dayEnd } = dayBoundsForScheduledAt(opts.scheduledAt);

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

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date();
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDayLabel(d: Date): string {
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${weekday} ${date}`;
}

function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${weekday} ${date} às ${time}`;
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
    .select("operating_hours")
    .eq("clinic_id", opts.clinicId)
    .maybeSingle();

  const operatingHours = (vaSettings?.operating_hours as OperatingHoursMap) ?? {};

  return {
    clinicId: opts.clinicId,
    doctorId: opts.doctorId,
    durationMinutes,
    defaultStart,
    defaultEnd,
    operatingHours,
  };
}

function getDayOperatingConfig(ctx: SlotSearchContext, dayDate: Date): DayOperatingConfig | null {
  const dayKey = DAY_KEY_BY_JS[dayDate.getDay()];
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

async function scanDaySlots(
  supabase: SupabaseClient,
  ctx: SlotSearchContext,
  dayDate: Date,
  dayConfig: DayOperatingConfig,
  opts: {
    slotStep: number;
    maxSlots: number;
    period?: SlotPeriod;
    timeOnlyLabel?: boolean;
    excludeAppointmentId?: string | null;
  }
): Promise<AvailableSlot[]> {
  const slots: AvailableSlot[] = [];
  const { startMinute, endMinute } = getPeriodMinuteBounds(dayConfig, opts.period);
  let minute = startMinute;

  while (minute + ctx.durationMinutes <= endMinute && slots.length < opts.maxSlots) {
    if (isMinuteInLunch(dayConfig, minute, ctx.durationMinutes)) {
      minute = dayConfig.lunchEnd!;
      continue;
    }

    const slotStart = new Date(dayDate);
    slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);

    if (slotStart.getTime() <= Date.now()) {
      minute += opts.slotStep;
      continue;
    }

    const scheduledAt = slotStart.toISOString();
    const scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, ctx.durationMinutes);

    const conflict = await checkAppointmentConflict(supabase, {
      clinicId: ctx.clinicId,
      doctorId: ctx.doctorId,
      scheduledAt,
      scheduledEndAt,
      excludeAppointmentId: opts.excludeAppointmentId ?? null,
    });

    if (!conflict) {
      slots.push({
        scheduled_at: scheduledAt,
        scheduled_end_at: scheduledEndAt,
        label: opts.timeOnlyLabel ? formatTimeLabel(scheduledAt) : formatSlotLabel(scheduledAt),
      });
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
  dayDate: Date,
  dayConfig: DayOperatingConfig,
  slotStep: number
): Promise<DaySlot[]> {
  const slots: DaySlot[] = [];
  const { startMinute, endMinute } = getPeriodMinuteBounds(dayConfig);
  let minute = startMinute;
  const now = Date.now();

  while (minute + ctx.durationMinutes <= endMinute) {
    const slotStart = new Date(dayDate);
    slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    const scheduledAt = slotStart.toISOString();
    const scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, ctx.durationMinutes);
    const period = getSlotPeriod(dayConfig, minute);

    let available = true;
    let reason: DaySlot["reason"];

    if (slotStart.getTime() <= now) {
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
      label: formatTimeLabel(scheduledAt),
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
  dayDate: Date,
  dayConfig: DayOperatingConfig
): Promise<SlotPeriod[]> {
  const periods: SlotPeriod[] = [];

  for (const period of ["manha", "tarde"] as SlotPeriod[]) {
    const slots = await scanDaySlots(supabase, ctx, dayDate, dayConfig, {
      slotStep: 15,
      maxSlots: 1,
      period,
      timeOnlyLabel: true,
    });
    if (slots.length > 0) periods.push(period);
  }

  return periods;
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
  const dayDate = parseDateLocal(opts.date);
  const dayConfig = getDayOperatingConfig(ctx, dayDate);
  if (!dayConfig) return [];
  return dayHasAvailability(supabase, ctx, dayDate, dayConfig);
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
  const cursor = new Date(opts.fromDate ?? new Date());
  cursor.setHours(0, 0, 0, 0);

  const days: AvailableDay[] = [];
  let skipped = 0;

  for (let day = 0; day < daysAhead; day++) {
    const current = new Date(cursor);
    current.setDate(cursor.getDate() + day);
    const dayConfig = getDayOperatingConfig(ctx, current);
    if (!dayConfig) continue;

    const periods = await dayHasAvailability(supabase, ctx, current, dayConfig);
    if (periods.length === 0) continue;

    if (skipped < skipDays) {
      skipped++;
      continue;
    }

    days.push({
      date: formatDateIso(current),
      label: formatDayLabel(current),
      periods,
    });

    if (days.length >= maxDays) {
      let hasMore = false;
      for (let remaining = day + 1; remaining < daysAhead; remaining++) {
        const nextDate = new Date(cursor);
        nextDate.setDate(cursor.getDate() + remaining);
        const nextConfig = getDayOperatingConfig(ctx, nextDate);
        if (!nextConfig) continue;
        const nextPeriods = await dayHasAvailability(supabase, ctx, nextDate, nextConfig);
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
  }
): Promise<AvailableSlot[]> {
  const ctx = await loadSlotSearchContext(supabase, opts);
  const dayDate = parseDateLocal(opts.date);
  const dayConfig = getDayOperatingConfig(ctx, dayDate);
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

  return scanDaySlots(supabase, ctx, dayDate, dayConfig, {
    slotStep: opts.slotStepMinutes ?? 30,
    maxSlots: opts.maxSlots ?? 6,
    period: opts.period,
    timeOnlyLabel: true,
    excludeAppointmentId: excludeId,
  });
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
  const dayDate = parseDateLocal(opts.date);
  const dayConfig = getDayOperatingConfig(ctx, dayDate);

  if (!dayConfig) {
    return { date: opts.date, periods: [], slots: [] };
  }

  const slotStep = opts.slotStepMinutes ?? 30;
  const slots = await scanDaySlotGrid(supabase, ctx, dayDate, dayConfig, slotStep);
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
  const fromDate = opts.fromDate ?? new Date();
  const daysAhead = opts.daysAhead ?? 14;
  const maxSlots = opts.maxSlots ?? 8;
  const slotStep = opts.slotStepMinutes ?? 15;

  const ctx = await loadSlotSearchContext(supabase, opts);
  const slots: AvailableSlot[] = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);

  for (let day = 0; day < daysAhead && slots.length < maxSlots; day++) {
    const current = new Date(cursor);
    current.setDate(cursor.getDate() + day);
    const dayConfig = getDayOperatingConfig(ctx, current);
    if (!dayConfig) continue;

    const daySlots = await scanDaySlots(supabase, ctx, current, dayConfig, {
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
