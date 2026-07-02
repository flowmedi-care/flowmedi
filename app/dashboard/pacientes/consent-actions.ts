"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getClinicConsentSettings,
  listPatientConsents,
  recordPatientConsent,
  revokePatientConsent,
  type ConsentPurpose,
} from "@/lib/consent/consent-service";
import { insertAuditLog } from "@/lib/audit-log";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Não autorizado.", profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { supabase, error: "Clínica não encontrada.", profile: null };
  if (!["admin", "secretaria", "medico"].includes(profile.role)) {
    return { supabase, error: "Sem permissão.", profile: null };
  }

  return { supabase, error: null, profile };
}

export async function getPatientConsentsAction(patientId: string) {
  const { supabase, error, profile } = await requireStaff();
  if (error || !profile) return { data: [], settings: null, error };

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) return { data: [], settings: null, error: "Paciente não encontrado." };

  const [consents, settings] = await Promise.all([
    listPatientConsents(supabase, patientId),
    getClinicConsentSettings(supabase, profile.clinic_id),
  ]);

  return { data: consents.data, settings, error: consents.error };
}

export async function registerPatientConsentAction(
  patientId: string,
  purpose: ConsentPurpose,
  textAccepted: string
) {
  const { supabase, error, profile } = await requireStaff();
  if (error || !profile) return { error };

  const { data: patient } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) return { error: "Paciente não encontrado." };

  const res = await recordPatientConsent(supabase, {
    clinicId: profile.clinic_id,
    patientId,
    purpose,
    textAccepted: textAccepted.trim(),
    recordedBy: profile.id,
    source: "dashboard",
  });

  if (!res.error) {
    await insertAuditLog(supabase, {
      clinic_id: profile.clinic_id,
      user_id: profile.id,
      action: "consent_recorded",
      entity_type: "consent",
      entity_id: patientId,
      new_values: { purpose, text_accepted: textAccepted.trim() },
    });
    revalidatePath(`/dashboard/pacientes/${patientId}`);
    revalidatePath(`/dashboard/contatos/pacientes/${patientId}`);
  }

  return res;
}

export async function revokePatientConsentAction(consentId: string, patientId: string) {
  const { supabase, error, profile } = await requireStaff();
  if (error || !profile) return { error };

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) return { error: "Paciente não encontrado." };

  const res = await revokePatientConsent(supabase, consentId, patientId);

  if (!res.error) {
    await insertAuditLog(supabase, {
      clinic_id: profile.clinic_id,
      user_id: profile.id,
      action: "consent_revoked",
      entity_type: "consent",
      entity_id: consentId,
      old_values: { patient_id: patientId },
    });
    revalidatePath(`/dashboard/pacientes/${patientId}`);
    revalidatePath(`/dashboard/contatos/pacientes/${patientId}`);
  }

  return res;
}

export async function updateClinicConsentSettingsAction(settings: {
  require_consent_for_marketing: boolean;
  block_marketing_without_consent: boolean;
  default_consent_text: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Apenas administradores podem alterar." };
  }

  const { error } = await supabase.from("clinic_consent_settings").upsert(
    {
      clinic_id: profile.clinic_id,
      require_consent_for_marketing: settings.require_consent_for_marketing,
      block_marketing_without_consent: settings.block_marketing_without_consent,
      default_consent_text: settings.default_consent_text.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" }
  );

  if (!error) {
    revalidatePath("/dashboard/configuracoes");
  }

  return { error: error?.message ?? null };
}
