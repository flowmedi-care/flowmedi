import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesMatch, normalizePhoneForMatch } from "../patient-lookup";
import { normalizeCpf } from "../normalize-cpf";

export type PatientPhoneRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  cpf: string | null;
  custom_fields: unknown;
};

/** All clinic patients whose phone matches (handles duplicates). */
export async function lookupPatientsByPhone(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
): Promise<PatientPhoneRow[]> {
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, birth_date, cpf, custom_fields")
    .eq("clinic_id", clinicId)
    .not("phone", "is", null);

  return (patients ?? []).filter((p) =>
    phonesMatch(String(p.phone ?? ""), phone)
  ) as PatientPhoneRow[];
}

/**
 * Canonical patient for a phone.
 * Root cause of empty cancel lists: duplicates + `.find` first match without appointments.
 * Prefer the match that has cancellable (agendada|confirmada) appointments; else first match.
 */
export async function lookupPatientByPhone(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
) {
  const matches = await lookupPatientsByPhone(supabase, clinicId, phone);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const ids = matches.map((m) => m.id);
  const now = new Date().toISOString();
  const { data: appts } = await supabase
    .from("appointments")
    .select("patient_id, scheduled_at")
    .eq("clinic_id", clinicId)
    .in("patient_id", ids)
    .in("status", ["agendada", "confirmada"])
    .gte("scheduled_at", now)
    .order("scheduled_at", { ascending: true });

  if (appts?.length) {
    const preferredId = String(appts[0].patient_id);
    return matches.find((m) => m.id === preferredId) ?? matches[0];
  }

  return matches[0];
}

export async function registerPatientViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  data: { full_name: string; phone: string; email?: string | null }
): Promise<{ patientId: string | null; error: string | null }> {
  const existing = await lookupPatientByPhone(supabase, clinicId, data.phone);
  if (existing) return { patientId: existing.id, error: null };

  // Store national digits (no country code) to reduce duplicate keys with/without 55.
  const phoneDigits = normalizePhoneForMatch(data.phone.replace(/\D/g, ""));

  const { data: newPatient, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      full_name: data.full_name.trim(),
      phone: phoneDigits,
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
      const normalized = normalizeCpf(value);
      if (!normalized) {
        return { ok: false, error: "CPF inválido. Informe 11 dígitos." };
      }
      const existing = patient.cpf ? String(patient.cpf).replace(/\D/g, "") : "";
      if (existing === normalized) {
        return { ok: true, error: null };
      }
      updateData.cpf = normalized;
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
