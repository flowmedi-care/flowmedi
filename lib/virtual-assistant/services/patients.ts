import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesMatch } from "../patient-lookup";

export async function lookupPatientByPhone(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
) {
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, birth_date")
    .eq("clinic_id", clinicId)
    .not("phone", "is", null);

  const patient = (patients ?? []).find((p) => phonesMatch(String(p.phone ?? ""), phone));
  if (!patient) return null;
  return patient;
}

export async function registerPatientViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  data: { full_name: string; phone: string; email?: string | null }
): Promise<{ patientId: string | null; error: string | null }> {
  const existing = await lookupPatientByPhone(supabase, clinicId, data.phone);
  if (existing) return { patientId: existing.id, error: null };

  const { data: newPatient, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      full_name: data.full_name.trim(),
      phone: data.phone.replace(/\D/g, ""),
      email: data.email?.trim() || null,
      custom_fields: {},
    })
    .select("id")
    .single();

  if (error) return { patientId: null, error: error.message };
  if (!newPatient?.id) return { patientId: null, error: "Erro ao cadastrar paciente." };

  try {
    await supabase.rpc("create_event_timeline", {
      p_clinic_id: clinicId,
      p_event_code: "patient_registered",
      p_patient_id: newPatient.id,
      p_metadata: { source: "virtual_assistant" },
    });
  } catch (e) {
    console.error("[VirtualAssistant] patient_registered event:", e);
  }

  return { patientId: newPatient.id, error: null };
}

export async function linkConversationToPatient(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  patientId: string
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .update({ patient_id: patientId })
    .eq("id", conversationId)
    .eq("clinic_id", clinicId);
}

export async function updatePatientIntakeViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  fields: Record<string, unknown>
): Promise<{ ok: boolean; error: string | null }> {
  const { data: patient, error: fetchErr } = await supabase
    .from("patients")
    .select("id, cpf, email, custom_fields")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (fetchErr || !patient) {
    return { ok: false, error: fetchErr?.message ?? "Paciente não encontrado." };
  }

  const updateData: Record<string, unknown> = {};
  const customFields = { ...((patient.custom_fields as Record<string, unknown>) ?? {}) };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "cpf") {
      updateData.cpf = String(value).trim();
    } else if (key === "email") {
      updateData.email = String(value).trim();
    } else if (key.startsWith("custom:")) {
      const fieldName = key.slice("custom:".length);
      customFields[fieldName] = value;
    } else {
      customFields[key] = value;
    }
  }

  if (Object.keys(customFields).length) {
    updateData.custom_fields = customFields;
  }

  if (!Object.keys(updateData).length) {
    return { ok: true, error: null };
  }

  const { error } = await supabase
    .from("patients")
    .update(updateData)
    .eq("id", patientId)
    .eq("clinic_id", clinicId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
