import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  dayBoundsForScheduledAt,
  formatConflictTimeRange,
  intervalsOverlap,
  resolveAppointmentEndMs,
} from "@/lib/appointment-scheduling";
import {
  DEFAULT_CLINIC_TIMEZONE,
  getClinicTimezone,
  zonedLocalToUtcIso,
} from "@/lib/clinic-timezone";
import type { RecurrenceFrequency } from "@/lib/recurrence-schedule";

export type ScheduleBlockKind = "once" | "recurring";

export type ScheduleBlockRow = {
  id: string;
  clinic_id: string;
  doctor_id: string | null;
  title: string | null;
  block_kind: ScheduleBlockKind;
  starts_at: string | null;
  ends_at: string | null;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_weekday: number | null;
  time_start: string;
  time_end: string;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BlockOccurrence = {
  blockId: string;
  startsAt: string;
  endsAt: string;
  doctorId: string | null;
  title: string | null;
};

/** Ocorrência expandida para renderização no calendário. */
export type ScheduleBlockCalendarItem = BlockOccurrence & {
  occurrenceKey: string;
};

export type ScheduleBlockInput = {
  blockKind: ScheduleBlockKind;
  doctorId: string | null;
  title?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceWeekday?: number | null;
  timeStart: string;
  timeEnd: string;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
};

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimeHm(time: string): string {
  return time.slice(0, 5);
}

function combineDateAndTime(
  dateYmd: string,
  timeStr: string,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): Date {
  const hm = parseTimeHm(timeStr);
  const [hourStr, minStr] = hm.split(":");
  const hour = Number(hourStr);
  const minute = Number(minStr);
  return new Date(zonedLocalToUtcIso(dateYmd, hour, minute, timeZone));
}

function alignToWeekday(dateYmd: string, weekday: number): string {
  const d = new Date(`${dateYmd}T12:00:00`);
  let guard = 0;
  while (d.getDay() !== weekday && guard < 7) {
    d.setDate(d.getDate() + 1);
    guard += 1;
  }
  return toYMD(d);
}

function advanceRecurringDate(d: Date, frequency: RecurrenceFrequency): void {
  if (frequency === "semanal") {
    d.setDate(d.getDate() + 7);
  } else if (frequency === "quinzenal") {
    d.setDate(d.getDate() + 14);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
}

/** Gera ocorrências concretas de um bloqueio no intervalo [rangeStart, rangeEnd]. */
export function expandBlockOccurrences(
  block: ScheduleBlockRow,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): BlockOccurrence[] {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const base = {
    blockId: block.id,
    doctorId: block.doctor_id,
    title: block.title,
  };

  if (block.block_kind === "once") {
    if (!block.starts_at || !block.ends_at) return [];
    const startMs = new Date(block.starts_at).getTime();
    const endMs = new Date(block.ends_at).getTime();
    if (startMs < rangeEndMs && endMs > rangeStartMs) {
      return [
        {
          ...base,
          startsAt: block.starts_at,
          endsAt: block.ends_at,
        },
      ];
    }
    return [];
  }

  if (!block.recurrence_start_date || !block.recurrence_frequency) return [];

  let firstDate = block.recurrence_start_date;
  if (block.recurrence_weekday != null && block.recurrence_frequency === "semanal") {
    firstDate = alignToWeekday(firstDate, block.recurrence_weekday);
  }

  const timeStartHm = parseTimeHm(block.time_start);
  const timeEndHm = parseTimeHm(block.time_end);
  const seriesEndMs = block.recurrence_end_date
    ? new Date(zonedLocalToUtcIso(block.recurrence_end_date, 23, 59, timeZone)).getTime()
    : rangeEndMs;
  const effectiveEndMs = Math.min(rangeEndMs, seriesEndMs);

  const occurrences: BlockOccurrence[] = [];
  const current = new Date(`${firstDate}T12:00:00`);

  for (let i = 0; i < 500; i++) {
    const dateYmd = toYMD(current);
    const occStart = combineDateAndTime(dateYmd, timeStartHm, timeZone);
    const occEnd = combineDateAndTime(dateYmd, timeEndHm, timeZone);
    const occStartMs = occStart.getTime();
    const occEndMs = occEnd.getTime();

    if (occStartMs > effectiveEndMs) break;

    if (block.recurrence_end_date && dateYmd > block.recurrence_end_date) break;

    if (occEndMs > rangeStartMs && occStartMs < rangeEndMs) {
      occurrences.push({
        ...base,
        startsAt: occStart.toISOString(),
        endsAt: occEnd.toISOString(),
      });
    }

    advanceRecurringDate(current, block.recurrence_frequency);
  }

  return occurrences;
}

/** Expande todas as ocorrências futuras de um bloqueio (até 2 anos ou recurrence_end_date). */
export function expandAllBlockOccurrences(
  block: ScheduleBlockRow,
  fromDate: Date = new Date(),
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): BlockOccurrence[] {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 2);
  if (block.recurrence_end_date) {
    const seriesEnd = new Date(
      zonedLocalToUtcIso(block.recurrence_end_date, 23, 59, timeZone)
    );
    if (seriesEnd.getTime() < end.getTime()) {
      end.setTime(seriesEnd.getTime());
    }
  }
  return expandBlockOccurrences(block, start, end, timeZone);
}

function formatBlockConflictMessage(
  block: ScheduleBlockRow,
  occStartMs: number,
  occEndMs: number,
  doctorName?: string | null
): string {
  const range = formatConflictTimeRange(occStartMs, occEndMs);
  const reason = block.title?.trim();
  const suffix = reason ? ` (${reason})` : "";

  if (block.doctor_id) {
    const name = doctorName?.trim() || "O profissional";
    return `${name} está indisponível das ${range}${suffix}.`;
  }
  return `A clínica está indisponível das ${range}${suffix}.`;
}

export async function checkScheduleBlockConflict(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    doctorId: string;
    scheduledAt: string;
    scheduledEndAt: string;
    excludeBlockId?: string | null;
    timeZone?: string;
  }
): Promise<string | null> {
  const start = new Date(opts.scheduledAt).getTime();
  const end = new Date(opts.scheduledEndAt).getTime();
  const timeZone =
    opts.timeZone ?? (await getClinicTimezone(supabase, opts.clinicId));
  const { dayStart, dayEnd } = dayBoundsForScheduledAt(opts.scheduledAt, timeZone);

  let query = supabase
    .from("schedule_blocks")
    .select("*")
    .eq("clinic_id", opts.clinicId)
    .or(`doctor_id.is.null,doctor_id.eq.${opts.doctorId}`);

  if (opts.excludeBlockId) {
    query = query.neq("id", opts.excludeBlockId);
  }

  const { data: blocks } = await query;
  if (!blocks?.length) return null;

  const { data: doctor } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", opts.doctorId)
    .single();
  const doctorName = (doctor?.full_name as string | undefined) ?? null;

  const dayStartDate = new Date(dayStart);
  const dayEndDate = new Date(dayEnd);

  for (const raw of blocks) {
    const block = raw as ScheduleBlockRow;
    const occurrences = expandBlockOccurrences(
      block,
      dayStartDate,
      dayEndDate,
      timeZone
    );
    for (const occ of occurrences) {
      const occStart = new Date(occ.startsAt).getTime();
      const occEnd = new Date(occ.endsAt).getTime();
      if (intervalsOverlap(start, end, occStart, occEnd)) {
        return formatBlockConflictMessage(
          block,
          occStart,
          occEnd,
          block.doctor_id ? doctorName : null
        );
      }
    }
  }

  return null;
}

export async function checkBlockAgainstAppointments(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    block: ScheduleBlockRow | ScheduleBlockInput;
    excludeBlockId?: string | null;
  }
): Promise<string | null> {
  const row = normalizeBlockForExpansion(opts.block, opts.excludeBlockId);

  const occurrences = expandAllBlockOccurrences(row);
  if (!occurrences.length) return null;

  const doctorFilter = row.doctor_id
    ? { doctorId: row.doctor_id }
    : { clinicWide: true as const };

  for (const occ of occurrences) {
    const { dayStart, dayEnd } = dayBoundsForScheduledAt(occ.startsAt);
    let apptQuery = supabase
      .from("appointments")
      .select("id, scheduled_at, scheduled_end_at, doctor:profiles!doctor_id(full_name), patient:patients(full_name)")
      .eq("clinic_id", opts.clinicId)
      .neq("status", "cancelada")
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if ("doctorId" in doctorFilter) {
      apptQuery = apptQuery.eq("doctor_id", doctorFilter.doctorId);
    }

    const { data: appointments } = await apptQuery;
    const occStart = new Date(occ.startsAt).getTime();
    const occEnd = new Date(occ.endsAt).getTime();

    for (const appt of appointments ?? []) {
      const apptStart = new Date(appt.scheduled_at).getTime();
      const apptEnd = resolveAppointmentEndMs(
        appt.scheduled_at,
        appt.scheduled_end_at as string | null,
        DEFAULT_APPOINTMENT_DURATION_MINUTES
      );
      if (intervalsOverlap(occStart, occEnd, apptStart, apptEnd)) {
        const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
        const patientName =
          (patient as { full_name?: string } | null)?.full_name?.trim() || "paciente";
        const range = formatConflictTimeRange(apptStart, apptEnd);
        if (row.doctor_id) {
          return `Já existe consulta de ${patientName} das ${range} neste período bloqueado.`;
        }
        const doctor = Array.isArray(appt.doctor) ? appt.doctor[0] : appt.doctor;
        const doctorName =
          (doctor as { full_name?: string } | null)?.full_name?.trim() || "profissional";
        return `Já existe consulta de ${patientName} com ${doctorName} das ${range} neste período bloqueado.`;
      }
    }
  }

  return null;
}

function normalizeBlockForExpansion(
  block: ScheduleBlockRow | ScheduleBlockInput,
  excludeBlockId?: string | null
): ScheduleBlockRow {
  if ("block_kind" in block) {
    return block;
  }
  return {
    id: excludeBlockId ?? "draft",
    clinic_id: "",
    doctor_id: block.doctorId,
    title: block.title ?? null,
    block_kind: block.blockKind,
    starts_at: block.startsAt ?? null,
    ends_at: block.endsAt ?? null,
    recurrence_frequency: block.recurrenceFrequency ?? null,
    recurrence_weekday: block.recurrenceWeekday ?? null,
    time_start: block.timeStart,
    time_end: block.timeEnd,
    recurrence_start_date: block.recurrenceStartDate ?? null,
    recurrence_end_date: block.recurrenceEndDate ?? null,
  };
}

export function validateScheduleBlockInput(input: ScheduleBlockInput): string | null {
  const timeStart = parseTimeHm(input.timeStart);
  const timeEnd = parseTimeHm(input.timeEnd);
  const startParts = timeStart.split(":").map(Number);
  const endParts = timeEnd.split(":").map(Number);
  const startMin = startParts[0] * 60 + (startParts[1] || 0);
  const endMin = endParts[0] * 60 + (endParts[1] || 0);

  if (input.blockKind === "once") {
    if (!input.startsAt || !input.endsAt) {
      return "Informe data e horário de início e término.";
    }
    const start = new Date(input.startsAt).getTime();
    const end = new Date(input.endsAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "Data ou horário inválido.";
    }
    if (end <= start) {
      return "O horário de término deve ser depois do início.";
    }
    return null;
  }

  if (!input.recurrenceStartDate || !input.recurrenceFrequency) {
    return "Informe a data de início e a frequência da recorrência.";
  }
  if (endMin <= startMin) {
    return "O horário de término deve ser depois do início.";
  }
  if (
    input.recurrenceEndDate &&
    input.recurrenceEndDate < input.recurrenceStartDate
  ) {
    return "A data final deve ser igual ou posterior à data de início.";
  }
  return null;
}

export function rowToScheduleBlockInput(row: ScheduleBlockRow): ScheduleBlockInput {
  return {
    blockKind: row.block_kind,
    doctorId: row.doctor_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    recurrenceFrequency: row.recurrence_frequency,
    recurrenceWeekday: row.recurrence_weekday,
    timeStart: parseTimeHm(row.time_start),
    timeEnd: parseTimeHm(row.time_end),
    recurrenceStartDate: row.recurrence_start_date,
    recurrenceEndDate: row.recurrence_end_date,
  };
}

export function scheduleBlockInputToDbRow(
  clinicId: string,
  input: ScheduleBlockInput,
  createdBy: string
): Record<string, unknown> {
  return {
    clinic_id: clinicId,
    doctor_id: input.doctorId,
    title: input.title?.trim() || null,
    block_kind: input.blockKind,
    starts_at: input.blockKind === "once" ? input.startsAt : null,
    ends_at: input.blockKind === "once" ? input.endsAt : null,
    recurrence_frequency:
      input.blockKind === "recurring" ? input.recurrenceFrequency : null,
    recurrence_weekday:
      input.blockKind === "recurring" ? input.recurrenceWeekday : null,
    time_start: `${parseTimeHm(input.timeStart)}:00`,
    time_end: `${parseTimeHm(input.timeEnd)}:00`,
    recurrence_start_date:
      input.blockKind === "recurring" ? input.recurrenceStartDate : null,
    recurrence_end_date:
      input.blockKind === "recurring" ? input.recurrenceEndDate || null : null,
    created_by: createdBy,
    updated_at: new Date().toISOString(),
  };
}

export function formatBlockScopeLabel(doctorId: string | null, doctorName?: string | null): string {
  if (!doctorId) return "Toda a clínica";
  return doctorName?.trim() || "Profissional";
}

export function formatBlockKindLabel(kind: ScheduleBlockKind): string {
  return kind === "once" ? "Avulso" : "Recorrente";
}

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];
