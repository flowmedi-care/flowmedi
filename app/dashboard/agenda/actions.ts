"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function generateLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
}

export async function createAppointment(
  patientId: string,
  doctorId: string,
  appointmentTypeId: string | null,
  scheduledAt: string,
  notes?: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { data: appointment, error: insertErr } = await supabase
    .from("appointments")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_type_id: appointmentTypeId || null,
      scheduled_at: scheduledAt,
      status: "agendada",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!appointment) return { error: "Erro ao criar consulta." };

  if (appointmentTypeId) {
    const { data: templates } = await supabase
      .from("form_templates")
      .select("id")
      .eq("appointment_type_id", appointmentTypeId);

    if (templates?.length) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from("form_instances").insert(
        templates.map((t) => ({
          appointment_id: appointment.id,
          form_template_id: t.id,
          status: "pendente",
          link_token: generateLinkToken(),
          link_expires_at: expiresAt.toISOString(),
          responses: {},
        }))
      );
    }
  }

  revalidatePath("/dashboard/agenda");
  return { data: { id: appointment.id }, error: null };
}

export async function updateAppointment(
  id: string,
  data: {
    patient_id?: string;
    doctor_id?: string;
    appointment_type_id?: string | null;
    scheduled_at?: string;
    status?: string;
    notes?: string | null;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/agenda/consulta/${id}`);
  return { error: null };
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  return { error: null };
}
