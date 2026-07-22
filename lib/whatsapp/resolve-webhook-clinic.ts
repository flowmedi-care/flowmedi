import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsappIntegrationType = "whatsapp_meta" | "whatsapp_simple";

export type ResolvedWhatsappWebhookClinic = {
  clinicId: string;
  integrationType: WhatsappIntegrationType;
  accessToken: string | null;
  phoneNumberId: string | null;
};

/** Discard esperado (isolamento LGPD) — não é erro de processamento. */
export type WhatsappWebhookDiscardReason =
  | "missing_phone_number_id"
  | "no_owner"
  | "ambiguous_owner";

export type WhatsappWebhookClinicResolution =
  | { status: "resolved"; clinic: ResolvedWhatsappWebhookClinic }
  | { status: "discarded"; reason: WhatsappWebhookDiscardReason };

type IntegrationRow = {
  clinic_id: string;
  integration_type: string;
  metadata: Record<string, unknown> | null;
  credentials: Record<string, unknown> | null;
};

function phoneNumberIdFromMetadata(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.phone_number_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function accessTokenFromCredentials(credentials: Record<string, unknown> | null): string | null {
  const value = credentials?.access_token;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve a clínica dona do webhook pelo phone_number_id.
 * Sem match explícito e único → discarded (nunca fallback para outra clínica).
 */
export async function resolveWhatsappWebhookClinic(
  supabase: SupabaseClient,
  phoneNumberId: string | null | undefined
): Promise<WhatsappWebhookClinicResolution> {
  const normalizedPhoneId = phoneNumberId?.trim() || null;
  if (!normalizedPhoneId) {
    return { status: "discarded", reason: "missing_phone_number_id" };
  }

  const { data: integrations } = await supabase
    .from("clinic_integrations")
    .select("clinic_id, integration_type, metadata, credentials")
    .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
    .eq("status", "connected");

  const rows = (integrations ?? []) as IntegrationRow[];
  const matches = rows.filter(
    (row) => phoneNumberIdFromMetadata(row.metadata) === normalizedPhoneId
  );

  if (matches.length === 0) {
    return { status: "discarded", reason: "no_owner" };
  }

  if (matches.length > 1) {
    return { status: "discarded", reason: "ambiguous_owner" };
  }

  const byPhone = matches[0];
  return {
    status: "resolved",
    clinic: {
      clinicId: byPhone.clinic_id,
      integrationType: byPhone.integration_type as WhatsappIntegrationType,
      accessToken: accessTokenFromCredentials(byPhone.credentials),
      phoneNumberId: normalizedPhoneId,
    },
  };
}
