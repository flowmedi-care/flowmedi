"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada." };
  }

  const { error } = await supabase.from("patients").insert({
    clinic_id: profile.clinic_id,
    full_name: data.full_name,
    email: data.email || null,
    phone: data.phone || null,
    birth_date: data.birth_date || null,
    notes: data.notes || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { error: null };
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
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { error: null };
}

// Cadastra paciente a partir de não-cadastrado e vincula formulários públicos
export async function registerPatientFromPublicForm(
  email: string,
  data: {
    full_name: string;
    phone?: string | null;
    birth_date?: string | null;
    custom_fields?: Record<string, unknown>;
  }
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

  revalidatePath("/dashboard/pacientes");
  return { error: null, patientId };
}
