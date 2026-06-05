"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WaitlistMatchAlert } from "./actions";

export type WaitlistEntry = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string | null;
  preferredDate: string;
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
  procedureId: string | null;
  roomId: string | null;
  notes: string | null;
  status: string;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function freedSlotIntersectsPreference(
  freedStartIso: string,
  freedEndIso: string,
  preferredDate: string,
  prefStart: string | null,
  prefEnd: string | null
): boolean {
  const freedStart = new Date(freedStartIso);
  const freedEnd = new Date(freedEndIso);
  const freedDate = freedStart.toISOString().slice(0, 10);
  if (freedDate !== preferredDate) return false;

  if (!prefStart && !prefEnd) return true;

  const slotStartMin = freedStart.getHours() * 60 + freedStart.getMinutes();
  const slotEndMin = freedEnd.getHours() * 60 + freedEnd.getMinutes();
  const prefStartMin = prefStart ? timeToMinutes(prefStart.slice(0, 5)) : 0;
  const prefEndMin = prefEnd ? timeToMinutes(prefEnd.slice(0, 5)) : 24 * 60;

  return slotStartMin < prefEndMin && slotEndMin > prefStartMin;
}

export async function findWaitlistMatchesForFreedSlot(input: {
  clinicId: string;
  doctorId: string;
  roomId?: string | null;
  scheduledAt: string;
  scheduledEndAt: string;
}): Promise<WaitlistMatchAlert[]> {
  const supabase = await createClient();
  const preferredDate = input.scheduledAt.slice(0, 10);

  let query = supabase
    .from("appointment_waitlist")
    .select(
      `
      id,
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      room_id,
      patient:patients ( full_name )
    `
    )
    .eq("clinic_id", input.clinicId)
    .eq("doctor_id", input.doctorId)
    .eq("status", "ativa")
    .eq("preferred_date", preferredDate);

  if (input.roomId) {
    query = query.or(`room_id.is.null,room_id.eq.${input.roomId}`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("appointment_waitlist")) return [];
    return [];
  }

  const matches: WaitlistMatchAlert[] = [];
  for (const row of data ?? []) {
    const prefDate = String(row.preferred_date);
    const prefStart = row.preferred_time_start as string | null;
    const prefEnd = row.preferred_time_end as string | null;
    if (
      !freedSlotIntersectsPreference(
        input.scheduledAt,
        input.scheduledEndAt,
        prefDate,
        prefStart,
        prefEnd
      )
    ) {
      continue;
    }
    const patient = Array.isArray(row.patient) ? row.patient[0] : row.patient;
    matches.push({
      id: String(row.id),
      patientName: String((patient as { full_name?: string })?.full_name ?? "Paciente"),
      preferredDate: prefDate,
    });
  }
  return matches;
}

export async function listWaitlistEntries(
  preferredDate?: string,
  doctorId?: string
): Promise<{ error: string | null; entries: WaitlistEntry[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", entries: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", entries: [] };

  let query = supabase
    .from("appointment_waitlist")
    .select(
      `
      id,
      patient_id,
      doctor_id,
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      procedure_id,
      room_id,
      notes,
      status,
      patient:patients ( full_name ),
      doctor:profiles!doctor_id ( full_name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "ativa")
    .order("preferred_date", { ascending: true });

  if (preferredDate) query = query.eq("preferred_date", preferredDate);
  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("appointment_waitlist")) {
      return { error: null, entries: [] };
    }
    return { error: error.message, entries: [] };
  }

  return {
    error: null,
    entries: (data ?? []).map((r) => {
      const patient = Array.isArray(r.patient) ? r.patient[0] : r.patient;
      const doctor = Array.isArray(r.doctor) ? r.doctor[0] : r.doctor;
      return {
        id: String(r.id),
        patientId: String(r.patient_id),
        patientName: String((patient as { full_name?: string })?.full_name ?? ""),
        doctorId: String(r.doctor_id),
        doctorName: (doctor as { full_name?: string | null })?.full_name ?? null,
        preferredDate: String(r.preferred_date),
        preferredTimeStart: r.preferred_time_start != null ? String(r.preferred_time_start) : null,
        preferredTimeEnd: r.preferred_time_end != null ? String(r.preferred_time_end) : null,
        procedureId: r.procedure_id != null ? String(r.procedure_id) : null,
        roomId: r.room_id != null ? String(r.room_id) : null,
        notes: r.notes != null ? String(r.notes) : null,
        status: String(r.status),
      };
    }),
  };
}

export async function createWaitlistEntry(input: {
  patientId: string;
  doctorId: string;
  preferredDate: string;
  preferredTimeStart?: string | null;
  preferredTimeEnd?: string | null;
  procedureId?: string | null;
  roomId?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", id: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", id: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", id: null };
  }

  const { data, error } = await supabase
    .from("appointment_waitlist")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      preferred_date: input.preferredDate,
      preferred_time_start: input.preferredTimeStart || null,
      preferred_time_end: input.preferredTimeEnd || null,
      procedure_id: input.procedureId || null,
      room_id: input.roomId || null,
      notes: input.notes || null,
      status: "ativa",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };
  revalidatePath("/dashboard/agenda");
  return { error: null, id: String(data.id) };
}

export async function cancelWaitlistEntry(entryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("appointment_waitlist")
    .update({ status: "cancelada", updated_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  return { error: null };
}

export async function fulfillWaitlistEntry(entryId: string, appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("appointment_waitlist")
    .update({
      status: "atendida",
      fulfilled_appointment_id: appointmentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  return { error: null };
}
