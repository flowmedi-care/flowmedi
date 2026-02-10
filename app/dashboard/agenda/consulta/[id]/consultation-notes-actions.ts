"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ConsultationNote = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  clinic_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  doctor_name?: string;
};

export async function getConsultationNotes(
  appointmentId: string
): Promise<{ data: ConsultationNote[] | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { data: null, error: "Clínica não encontrada." };
  }

  const { data: notes, error } = await supabase
    .from("consultation_notes")
    .select(`
      *,
      doctor:profiles!consultation_notes_doctor_id_fkey ( full_name )
    `)
    .eq("appointment_id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const notesWithDoctorName = (notes || []).map((note: any) => {
    const doctor = Array.isArray(note.doctor) ? note.doctor[0] : note.doctor;
    return {
      ...note,
      doctor_name: doctor?.full_name || "Médico",
    };
  });

  return { data: notesWithDoctorName as ConsultationNote[], error: null };
}

export async function createConsultationNote(
  appointmentId: string,
  content: string
): Promise<{ error: string | null; data: ConsultationNote | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico") {
    return { error: "Apenas médicos podem criar posts da consulta.", data: null };
  }

  if (!profile.clinic_id) {
    return { error: "Clínica não encontrada.", data: null };
  }

  // Verificar se a consulta pertence à mesma clínica
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, clinic_id")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!appointment) {
    return { error: "Consulta não encontrada ou não pertence à sua clínica.", data: null };
  }

  const { data: note, error } = await supabase
    .from("consultation_notes")
    .insert({
      appointment_id: appointmentId,
      doctor_id: user.id,
      clinic_id: profile.clinic_id,
      content: content.trim(),
    })
    .select(`
      *,
      doctor:profiles!consultation_notes_doctor_id_fkey ( full_name )
    `)
    .single();

  if (error) return { error: error.message, data: null };

  const doctor = Array.isArray(note.doctor) ? note.doctor[0] : note.doctor;
  const noteWithDoctorName = {
    ...note,
    doctor_name: doctor?.full_name || "Médico",
  };

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  return { error: null, data: noteWithDoctorName as ConsultationNote };
}

export async function updateConsultationNote(
  noteId: string,
  content: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico") {
    return { error: "Apenas médicos podem editar posts da consulta." };
  }

  // Verificar se o post pertence ao médico
  const { data: note } = await supabase
    .from("consultation_notes")
    .select("id, appointment_id, doctor_id")
    .eq("id", noteId)
    .eq("doctor_id", user.id)
    .single();

  if (!note) {
    return { error: "Post não encontrado ou você não tem permissão para editá-lo." };
  }

  const { error } = await supabase
    .from("consultation_notes")
    .update({
      content: content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("doctor_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/agenda/consulta/${note.appointment_id}`);
  return { error: null };
}

export async function deleteConsultationNote(
  noteId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico") {
    return { error: "Apenas médicos podem deletar posts da consulta." };
  }

  // Verificar se o post pertence ao médico
  const { data: note } = await supabase
    .from("consultation_notes")
    .select("id, appointment_id, doctor_id")
    .eq("id", noteId)
    .eq("doctor_id", user.id)
    .single();

  if (!note) {
    return { error: "Post não encontrado ou você não tem permissão para deletá-lo." };
  }

  const { error } = await supabase
    .from("consultation_notes")
    .delete()
    .eq("id", noteId)
    .eq("doctor_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/agenda/consulta/${note.appointment_id}`);
  return { error: null };
}
