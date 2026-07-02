import type { SupabaseClient } from "@supabase/supabase-js";
import {
  consentPurposeForEvent,
  isTransactionalMessageEvent,
} from "./event-categories";

export type ConsentPurpose = "marketing" | "communications" | "data_processing";

export type ClinicConsentSettings = {
  clinic_id: string;
  require_consent_for_marketing: boolean;
  block_marketing_without_consent: boolean;
  default_consent_text: string | null;
  transactional_legal_basis_note: string | null;
};

const DEFAULT_SETTINGS: Omit<ClinicConsentSettings, "clinic_id"> = {
  require_consent_for_marketing: true,
  block_marketing_without_consent: true,
  default_consent_text:
    "Autorizo o recebimento de comunicações de marketing e promoções da clínica por e-mail e WhatsApp.",
  transactional_legal_basis_note: null,
};

export async function getClinicConsentSettings(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicConsentSettings> {
  const { data } = await supabase
    .from("clinic_consent_settings")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return {
    clinic_id: clinicId,
    ...DEFAULT_SETTINGS,
    ...(data ?? {}),
  } as ClinicConsentSettings;
}

export async function hasActiveConsent(
  supabase: SupabaseClient,
  patientId: string,
  purpose: ConsentPurpose
): Promise<boolean> {
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("patient_id", patientId)
    .eq("purpose", purpose)
    .is("revoked_at", null)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function canSendMessageToPatient(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  eventCode: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (isTransactionalMessageEvent(eventCode)) {
    return { allowed: true };
  }

  const settings = await getClinicConsentSettings(supabase, clinicId);
  if (!settings.block_marketing_without_consent) {
    return { allowed: true };
  }

  const purpose = consentPurposeForEvent(eventCode);
  const hasConsent = await hasActiveConsent(supabase, patientId, purpose);

  if (!hasConsent) {
    return {
      allowed: false,
      reason:
        `Envio bloqueado: paciente sem consentimento ativo (${purpose}). ` +
        "Registre o consentimento no perfil do paciente ou utilize apenas mensagens transacionais.",
    };
  }

  return { allowed: true };
}

export async function listPatientConsents(
  supabase: SupabaseClient,
  patientId: string
) {
  const { data, error } = await supabase
    .from("consents")
    .select("id, purpose, text_accepted, accepted_at, revoked_at, ip_address, source")
    .eq("patient_id", patientId)
    .order("accepted_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function recordPatientConsent(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string;
    purpose: ConsentPurpose;
    textAccepted: string;
    recordedBy: string | null;
    ipAddress?: string | null;
    source?: string;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("consents").insert({
    clinic_id: params.clinicId,
    patient_id: params.patientId,
    purpose: params.purpose,
    text_accepted: params.textAccepted,
    recorded_by: params.recordedBy,
    ip_address: params.ipAddress ?? null,
    source: params.source ?? "dashboard",
    accepted_at: new Date().toISOString(),
  });

  return { error: error?.message ?? null };
}

export async function revokePatientConsent(
  supabase: SupabaseClient,
  consentId: string,
  patientId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", consentId)
    .eq("patient_id", patientId)
    .is("revoked_at", null);

  return { error: error?.message ?? null };
}
