"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/form-slug";
import type { FormFieldDefinition } from "@/lib/form-types";

export type FormReportItem = {
  id: string;
  status: string;
  template_name: string;
  definition: FormFieldDefinition[];
  responses: Record<string, unknown>;
  appointment_id: string | null;
  scheduled_at: string | null;
  is_current_appointment: boolean;
};

function mapFormRow(
  row: Record<string, unknown>,
  appointmentId: string
): FormReportItem | null {
  const ft = Array.isArray(row.form_template) ? row.form_template[0] : row.form_template;
  if (!ft) return null;
  const ftObj = ft as { name?: string; definition?: unknown };
  const appt = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
  const apptId = row.appointment_id != null ? String(row.appointment_id) : null;
  return {
    id: String(row.id),
    status: String(row.status ?? "pendente"),
    template_name: String(ftObj.name ?? "Relatório"),
    definition: (Array.isArray(ftObj.definition) ? ftObj.definition : []) as FormFieldDefinition[],
    responses: (row.responses as Record<string, unknown>) ?? {},
    appointment_id: apptId,
    scheduled_at: appt
      ? String((appt as { scheduled_at?: string }).scheduled_at ?? "")
      : null,
    is_current_appointment: apptId === appointmentId,
  };
}

export async function getFormReportsForAtendimento(
  appointmentId: string,
  patientId: string
): Promise<{ data: FormReportItem[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { data: [], error: "Clínica não encontrada." };

  const selectBase = `
    id,
    status,
    responses,
    appointment_id,
    form_template:form_templates ( name, definition )
  `;

  const { data: currentRows, error: curErr } = await supabase
    .from("form_instances")
    .select(selectBase)
    .eq("appointment_id", appointmentId);

  if (curErr) return { data: [], error: curErr.message };

  const { data: otherRows, error: otherErr } = await supabase
    .from("form_instances")
    .select(
      `
      ${selectBase.trim()},
      appointments!inner ( scheduled_at, patient_id, clinic_id )
    `
    )
    .eq("appointments.patient_id", patientId)
    .eq("appointments.clinic_id", profile.clinic_id)
    .neq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (otherErr && !otherErr.message.includes("does not exist")) {
    return { data: [], error: otherErr.message };
  }

  const seen = new Set<string>();
  const data: FormReportItem[] = [];

  for (const row of currentRows ?? []) {
    const item = mapFormRow(row as Record<string, unknown>, appointmentId);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      data.push(item);
    }
  }

  for (const row of otherRows ?? []) {
    const item = mapFormRow(row as Record<string, unknown>, appointmentId);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      data.push(item);
    }
  }

  data.sort((a, b) => {
    if (a.is_current_appointment !== b.is_current_appointment) {
      return a.is_current_appointment ? -1 : 1;
    }
    return a.template_name.localeCompare(b.template_name, "pt-BR");
  });

  return { data, error: null };
}

function revalidateConsultaAndAtendimento(appointmentId: string | null) {
  if (appointmentId) {
    revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
    revalidatePath(`/dashboard/agenda/atendimento/${appointmentId}`);
  }
}

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

  // Buscar dados da clínica, template e paciente para gerar slug amigável
  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name")
    .eq("id", profile.clinic_id)
    .single();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(`
      clinic_id,
      patient_id,
      patient:patients!inner(full_name)
    `)
    .eq("id", appointmentId)
    .single();

  const { data: template } = await supabase
    .from("form_templates")
    .select("name")
    .eq("id", formTemplateId)
    .single();

  // Gerar ou obter slug da clínica
  let clinicSlug = clinic?.slug;
  if (!clinicSlug) {
    clinicSlug = slugify(clinic?.name || "clinica");
    await supabase
      .from("clinics")
      .update({ slug: clinicSlug })
      .eq("id", profile.clinic_id);
  }

  // Gerar slugs amigáveis
  const patient = Array.isArray(appointment?.patient) 
    ? appointment.patient[0] 
    : appointment?.patient;
  const formSlug = template?.name ? slugify(template.name) : "formulario";
  const patientSlug = patient?.full_name ? slugify(patient.full_name) : "paciente";
  
  // Criar slug composto: {clinicSlug}/{formSlug}/{patientSlug}
  let combinedSlug = `${clinicSlug}/${formSlug}/${patientSlug}`;
  
  // Verificar se já existe e adicionar sufixo se necessário
  const { data: existingSlug } = await supabase
    .from("form_instances")
    .select("id")
    .eq("slug", combinedSlug)
    .maybeSingle();
  
  if (existingSlug) {
    for (let i = 1; i <= 10; i++) {
      const slugWithSuffix = `${combinedSlug}-${i}`;
      const { data: check } = await supabase
        .from("form_instances")
        .select("id")
        .eq("slug", slugWithSuffix)
        .maybeSingle();
      if (!check) {
        combinedSlug = slugWithSuffix;
        break;
      }
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const linkToken = crypto.randomUUID().replace(/-/g, "");

  const { data: inserted, error } = await supabase
    .from("form_instances")
    .insert({
      appointment_id: appointmentId,
      form_template_id: formTemplateId,
      status: "pendente",
      link_token: linkToken,
      slug: combinedSlug,
      link_expires_at: expiresAt.toISOString(),
      responses: {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!inserted) return { error: "Erro ao vincular formulário." };

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

  revalidateConsultaAndAtendimento(appointmentId);
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

  revalidateConsultaAndAtendimento(
    instance.appointment_id != null ? String(instance.appointment_id) : null
  );
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

  revalidateConsultaAndAtendimento(
    instance.appointment_id != null ? String(instance.appointment_id) : null
  );
  return { error: null };
}
