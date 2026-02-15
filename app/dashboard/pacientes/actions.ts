"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData, countMonthPatients } from "@/lib/plan-helpers";
import { canCreatePatient, getUpgradeMessage } from "@/lib/plan-gates";

export type PatientInsert = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, unknown>;
};

export type PatientUpdate = Partial<PatientInsert>;

export async function createPatient(data: PatientInsert) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", patientId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada.", patientId: null };
  }

  // Verificar limite de pacientes/mês (conta todos criados no mês, mesmo se deletados)
  const planData = await getClinicPlanData();
  if (planData && planData.limits.max_patients !== null) {
    const currentMonthCount = await countMonthPatients(profile.clinic_id);
    const check = canCreatePatient(planData.limits, currentMonthCount);
    
    if (!check.allowed) {
      const upgradeMsg = getUpgradeMessage("pacientes/mês");
      return { error: `${check.reason}. ${upgradeMsg}`, patientId: null };
    }
  }

  const { data: newPatient, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: profile.clinic_id,
      full_name: data.full_name,
      email: data.email || null,
      phone: data.phone || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, patientId: null };
  if (!newPatient?.id) return { error: "Erro ao criar paciente.", patientId: null };

  // Criar evento "usuário cadastrado" (mesma lógica da Central de Eventos: ação recomendada Nova consulta)
  const { error: eventError } = await supabase.rpc("create_event_timeline", {
    p_clinic_id: profile.clinic_id,
    p_event_code: "patient_registered",
    p_patient_id: newPatient.id,
    p_appointment_id: null,
    p_form_instance_id: null,
    p_origin: "user",
    p_metadata: {},
  });
  if (eventError) {
    console.error("[createPatient] create_event_timeline:", eventError);
    // Não falha o cadastro se o evento não for criado
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath("/dashboard/eventos");
  return { error: null, patientId: newPatient.id };
}

export async function updatePatient(id: string, data: PatientUpdate) {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.email !== undefined) updateData.email = data.email ?? null;
  if (data.phone !== undefined) updateData.phone = data.phone ?? null;
  if (data.birth_date !== undefined) updateData.birth_date = data.birth_date || null;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;
  if (data.custom_fields !== undefined) updateData.custom_fields = data.custom_fields || {};

  const { error } = await supabase
    .from("patients")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { error: null };
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("clinic_id, email")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) return { error: error.message };
  // Se o paciente tinha email (ex.: veio de não cadastrado), não mostrar de novo em "Não cadastrados"
  if (patient?.clinic_id && patient?.email?.trim()) {
    await supabase.from("excluded_submitter_emails").upsert(
      { clinic_id: patient.clinic_id, email: patient.email.trim().toLowerCase() },
      { onConflict: "clinic_id,email" }
    );
  }
  revalidatePath("/dashboard/pacientes");
  return { error: null };
}

// Cadastra paciente a partir de não-cadastrado e vincula formulários públicos.
// Se eventIdToLink for passado, atualiza o evento (ex.: public_form_completed) com patient_id para não mostrar "Cadastrar" de novo após F5.
export async function registerPatientFromPublicForm(
  email: string,
  data: {
    full_name: string;
    phone?: string | null;
    birth_date?: string | null;
    custom_fields?: Record<string, unknown>;
  },
  eventIdToLink?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", patientId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada.", patientId: null };
  }

  // Verificar se já existe paciente com este email
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", profile.clinic_id)
    .eq("email", email)
    .maybeSingle();

  let patientId: string;

  // Combinar campos customizados passados com os das instâncias públicas
  const combinedCustomFields: Record<string, unknown> = { ...(data.custom_fields || {}) };

  // Buscar campos customizados de todas as instâncias públicas deste email
  const { data: publicInstances } = await supabase
    .from("form_instances")
    .select(`
      public_submitter_custom_fields,
      form_templates!inner (
        clinic_id
      )
    `)
    .is("appointment_id", null)
    .eq("public_submitter_email", email)
    .eq("form_templates.clinic_id", profile.clinic_id)
    .not("public_submitter_custom_fields", "is", null);

  // Combinar todos os campos customizados de todas as instâncias
  (publicInstances ?? []).forEach((instance) => {
    if (instance.public_submitter_custom_fields) {
      Object.assign(combinedCustomFields, instance.public_submitter_custom_fields);
    }
  });

  if (existing) {
    // Atualizar paciente existente
    patientId = existing.id;
    const { error: updateError } = await supabase
      .from("patients")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        birth_date: data.birth_date || null,
        custom_fields: Object.keys(combinedCustomFields).length > 0 ? combinedCustomFields : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId);
    if (updateError) return { error: updateError.message, patientId: null };
  } else {
    // Criar novo paciente
    const { data: newPatient, error: insertError } = await supabase
      .from("patients")
      .insert({
        clinic_id: profile.clinic_id,
        full_name: data.full_name,
        email: email,
        phone: data.phone || null,
        birth_date: data.birth_date || null,
        custom_fields: Object.keys(combinedCustomFields).length > 0 ? combinedCustomFields : {},
      })
      .select("id")
      .single();
    if (insertError) return { error: insertError.message, patientId: null };
    if (!newPatient) return { error: "Erro ao criar paciente.", patientId: null };
    patientId = newPatient.id;
  }

  // Médico vinculado ao formulário público (se houver) para preencher na Nova consulta
  let doctorIdForEvent: string | null = null;
  const { data: publicInstance } = await supabase
    .from("form_instances")
    .select("form_template_id")
    .is("appointment_id", null)
    .eq("public_submitter_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (publicInstance?.form_template_id) {
    const { data: template } = await supabase
      .from("form_templates")
      .select("public_doctor_id")
      .eq("id", publicInstance.form_template_id)
      .eq("clinic_id", profile.clinic_id)
      .single();
    if (template?.public_doctor_id) doctorIdForEvent = template.public_doctor_id;
  }

  const eventMetadata: Record<string, unknown> = {};
  if (doctorIdForEvent) eventMetadata.doctor_id = doctorIdForEvent;

  // Disparar evento "usuário cadastrado" (ação recomendada: Agendar consulta)
  const { error: eventError } = await supabase.rpc("create_event_timeline", {
    p_clinic_id: profile.clinic_id,
    p_event_code: "patient_registered",
    p_patient_id: patientId,
    p_appointment_id: null,
    p_form_instance_id: null,
    p_origin: "user",
    p_metadata: eventMetadata,
  });
  if (eventError) {
    console.error("[registerPatientFromPublicForm] create_event_timeline:", eventError);
    // Não falha o cadastro se o evento não for criado
  }

  // Vincular evento ao paciente para que, após F5, o card não mostre "Cadastrar" de novo
  if (eventIdToLink) {
    await supabase
      .from("event_timeline")
      .update({ patient_id: patientId })
      .eq("id", eventIdToLink)
      .eq("clinic_id", profile.clinic_id);
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath("/dashboard/eventos");
  return { error: null, patientId };
}
