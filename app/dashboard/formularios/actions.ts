"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormTemplateDefinition } from "@/lib/form-types";

export async function createFormTemplate(
  name: string,
  definition: FormTemplateDefinition,
  appointmentTypeId: string | null
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

  const { error } = await supabase.from("form_templates").insert({
    clinic_id: profile.clinic_id,
    name: name.trim(),
    definition: definition as unknown as Record<string, unknown>[],
    appointment_type_id: appointmentTypeId || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  return { error: null };
}

export async function updateFormTemplate(
  id: string,
  name: string,
  definition: FormTemplateDefinition,
  appointmentTypeId: string | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .update({
      name: name.trim(),
      definition: definition as unknown as Record<string, unknown>[],
      appointment_type_id: appointmentTypeId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  revalidatePath(`/dashboard/formularios/${id}`);
  return { error: null };
}

export async function deleteFormTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("form_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  return { error: null };
}

export type AppointmentOption = {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_name: string | null;
};

export async function getAppointmentsByPatient(patientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const fromToday = new Date();
  fromToday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      scheduled_at,
      status,
      doctor:profiles ( full_name )
    `)
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .gte("scheduled_at", fromToday.toISOString())
    .in("status", ["agendada", "confirmada"])
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) return { error: error.message, data: null };
  const list: AppointmentOption[] = (data ?? []).map((a: Record<string, unknown>) => {
    const doc = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    return {
      id: String(a.id),
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      doctor_name: (doc as { full_name?: string } | null)?.full_name ?? null,
    };
  });
  return { error: null, data: list };
}

function generateLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
}

export async function ensureFormInstanceAndGetLink(
  appointmentId: string,
  formTemplateId: string
): Promise<{ error: string | null; link: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", link: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", link: null };

  const { data: existing } = await supabase
    .from("form_instances")
    .select("link_token")
    .eq("appointment_id", appointmentId)
    .eq("form_template_id", formTemplateId)
    .maybeSingle();

  if (existing?.link_token) {
    return { error: null, link: `/f/${existing.link_token}` };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data: inserted, error } = await supabase
    .from("form_instances")
    .insert({
      appointment_id: appointmentId,
      form_template_id: formTemplateId,
      status: "pendente",
      link_token: generateLinkToken(),
      link_expires_at: expiresAt.toISOString(),
      responses: {},
    })
    .select("link_token")
    .single();

  if (error) return { error: error.message, link: null };
  return {
    error: null,
    link: inserted?.link_token ? `/f/${inserted.link_token}` : null,
  };
}
