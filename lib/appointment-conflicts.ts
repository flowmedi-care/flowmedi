import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  dayBoundsForScheduledAt,
  formatConflictTimeRange,
  intervalsOverlap,
  buildScheduledEndFromDuration,
} from "./appointment-scheduling";

function resolveAppointmentEndMs(
  scheduledAt: string,
  scheduledEndAt: string | null,
  defaultMinutes: number
): number {
  if (scheduledEndAt) return new Date(scheduledEndAt).getTime();
  return new Date(scheduledAt).getTime() + defaultMinutes * 60 * 1000;
}

async function clinicRequiresRoom(supabase: SupabaseClient, clinicId: string): Promise<boolean> {
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

  return null;
}

export type AvailableSlot = {
  scheduled_at: string;
  scheduled_end_at: string;
  label: string;
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

function minutesToHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${weekday} ${date} às ${time}`;
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

  const operatingHours = (vaSettings?.operating_hours as Record<string, { open?: string; close?: string; lunch_start?: string; lunch_end?: string; closed?: boolean }>) ?? {};

  const slots: AvailableSlot[] = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);

  for (let day = 0; day < daysAhead && slots.length < maxSlots; day++) {
    const current = new Date(cursor);
    current.setDate(cursor.getDate() + day);
    const dayKey = DAY_KEY_BY_JS[current.getDay()];
    const dayConfig = operatingHours[dayKey];

    if (dayConfig?.closed) continue;

    const openHm = dayConfig?.open ?? defaultStart;
    const closeHm = dayConfig?.close ?? defaultEnd;
    const lunchStart = dayConfig?.lunch_start ? parseHmToMinutes(dayConfig.lunch_start) : null;
    const lunchEnd = dayConfig?.lunch_end ? parseHmToMinutes(dayConfig.lunch_end) : null;

    let minute = parseHmToMinutes(openHm);
    const endMinute = parseHmToMinutes(closeHm);

    while (minute + durationMinutes <= endMinute && slots.length < maxSlots) {
      if (lunchStart != null && lunchEnd != null && minute < lunchEnd && minute + durationMinutes > lunchStart) {
        minute = lunchEnd;
        continue;
      }

      const slotStart = new Date(current);
      slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);

      if (slotStart.getTime() <= Date.now()) {
        minute += slotStep;
        continue;
      }

      const scheduledAt = slotStart.toISOString();
      const scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, durationMinutes);

      const conflict = await checkAppointmentConflict(supabase, {
        clinicId: opts.clinicId,
        doctorId: opts.doctorId,
        scheduledAt,
        scheduledEndAt,
        excludeAppointmentId: null,
      });

      if (!conflict) {
        slots.push({
          scheduled_at: scheduledAt,
          scheduled_end_at: scheduledEndAt,
          label: formatSlotLabel(scheduledAt),
        });
      }

      minute += slotStep;
    }
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
