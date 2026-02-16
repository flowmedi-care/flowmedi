"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateUniqueFormSlug } from "@/lib/form-slug";

export async function getFormTemplatesForAppointment(
  appointmentId: string
): Promise<{ data: Array<{ id: string; name: string }> | null; error: string | null }> {
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

  // Buscar templates da clínica que não estão vinculados a esta consulta
  const { data: templates, error } = await supabase
    .from("form_templates")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  if (error) return { data: null, error: error.message };

  // Buscar templates já vinculados
  const { data: linkedInstances } = await supabase
    .from("form_instances")
    .select("form_template_id")
    .eq("appointment_id", appointmentId);

  const linkedTemplateIds = new Set(
    (linkedInstances || []).map((i) => i.form_template_id)
  );

  // Filtrar templates não vinculados
  const availableTemplates = (templates || []).filter(
    (t) => !linkedTemplateIds.has(t.id)
  );

  return { data: availableTemplates, error: null };
}

export async function linkFormToAppointment(
  appointmentId: string,
  formTemplateId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada." };
  }

  // Verificar se já existe instância
  const { data: existing } = await supabase
    .from("form_instances")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("form_template_id", formTemplateId)
    .maybeSingle();

  if (existing) {
    return { error: "Este formulário já está vinculado a esta consulta." };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const linkToken = crypto.randomUUID().replace(/-/g, "");
  const slug = await generateUniqueFormSlug(supabase);

  const { data: inserted, error } = await supabase
    .from("form_instances")
    .insert({
      appointment_id: appointmentId,
      form_template_id: formTemplateId,
      status: "pendente",
      link_token: linkToken,
      slug: slug,
      link_expires_at: expiresAt.toISOString(),
      responses: {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!inserted) return { error: "Erro ao vincular formulário." };

  // Buscar appointment (patient_id, clinic_id) para criar evento form_linked
  const { data: appointment } = await supabase
    .from("appointments")
    .select("clinic_id, patient_id")
    .eq("id", appointmentId)
    .single();

  if (appointment?.patient_id && appointment?.clinic_id) {
    try {
      const { data: eventId, error: eventErr } = await supabase.rpc("create_event_timeline", {
        p_clinic_id: appointment.clinic_id,
        p_event_code: "form_linked",
        p_patient_id: appointment.patient_id,
        p_appointment_id: appointmentId,
        p_form_instance_id: inserted.id,
        p_origin: "user",
      });
      if (!eventErr && eventId) {
        const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
        await runAutoSendForEvent(eventId, appointment.clinic_id, "form_linked", supabase);
      }
    } catch (e) {
      console.error("[linkFormToAppointment] form_linked event:", e);
      // Não falhar o vínculo se o envio falhar
    }
  }

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath("/dashboard/eventos");
  return { error: null };
}

export async function unlinkFormFromAppointment(
  formInstanceId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "secretaria", "medico"].includes(profile.role)) {
    return { error: "Você não tem permissão para desvincular formulários." };
  }

  // Verificar se a instância pertence à mesma clínica
  const { data: instance } = await supabase
    .from("form_instances")
    .select("appointment_id, form_template:form_templates!inner(clinic_id)")
    .eq("id", formInstanceId)
    .single();

  if (!instance) {
    return { error: "Formulário não encontrado." };
  }

  const template = Array.isArray(instance.form_template)
    ? instance.form_template[0]
    : instance.form_template;

  if (template.clinic_id !== profile.clinic_id) {
    return { error: "Você não tem permissão para desvincular este formulário." };
  }

  const { error: deleteError } = await supabase
    .from("form_instances")
    .delete()
    .eq("id", formInstanceId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/dashboard/agenda/consulta/${instance.appointment_id}`);
  return { error: null };
}

export async function submitFormPresentially(
  formInstanceId: string,
  responses: Record<string, unknown>
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
    return { error: "Apenas médicos podem responder formulários presencialmente." };
  }

  // Verificar se a instância pertence à mesma clínica
  const { data: instance } = await supabase
    .from("form_instances")
    .select("appointment_id, form_template:form_templates!inner(clinic_id)")
    .eq("id", formInstanceId)
    .single();

  if (!instance) {
    return { error: "Formulário não encontrado." };
  }

  const template = Array.isArray(instance.form_template)
    ? instance.form_template[0]
    : instance.form_template;

  if (template.clinic_id !== profile.clinic_id) {
    return { error: "Você não tem permissão para responder este formulário." };
  }

  const { error: updateError } = await supabase
    .from("form_instances")
    .update({
      responses,
      status: "respondido",
      updated_at: new Date().toISOString(),
    })
    .eq("id", formInstanceId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/dashboard/agenda/consulta/${instance.appointment_id}`);
  return { error: null };
}
