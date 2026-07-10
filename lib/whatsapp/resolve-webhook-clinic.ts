import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsappIntegrationType = "whatsapp_meta" | "whatsapp_simple";

export type ResolvedWhatsappWebhookClinic = {
  clinicId: string;
  integrationType: WhatsappIntegrationType;
  accessToken: string | null;
  phoneNumberId: string | null;
};

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

export async function resolveWhatsappWebhookClinic(
  supabase: SupabaseClient,
  phoneNumberId: string | null | undefined
): Promise<ResolvedWhatsappWebhookClinic | null> {
  const { data: integrations } = await supabase
    .from("clinic_integrations")
    .select("clinic_id, integration_type, metadata, credentials")
    .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
    .eq("status", "connected");

  const rows = (integrations ?? []) as IntegrationRow[];
  if (rows.length === 0) return null;

  const normalizedPhoneId = phoneNumberId?.trim() || null;

  if (normalizedPhoneId) {
    const byPhone = rows.find(
      (row) => phoneNumberIdFromMetadata(row.metadata) === normalizedPhoneId
    );
    if (byPhone) {
      return {
        clinicId: byPhone.clinic_id,
        integrationType: byPhone.integration_type as WhatsappIntegrationType,
        accessToken: accessTokenFromCredentials(byPhone.credentials),
        phoneNumberId: normalizedPhoneId,
      };
    }
  }

  if (rows.length === 1) {
    const only = rows[0];
    return {
      clinicId: only.clinic_id,
      integrationType: only.integration_type as WhatsappIntegrationType,
      accessToken: accessTokenFromCredentials(only.credentials),
      phoneNumberId: phoneNumberIdFromMetadata(only.metadata),
    };
  }

  return null;
}
