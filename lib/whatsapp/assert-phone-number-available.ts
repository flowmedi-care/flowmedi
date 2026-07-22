import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garante que phone_number_id não está connected em outra clínica.
 * Retorna mensagem de erro em português ou null se ok.
 */
export async function assertWhatsappPhoneNumberIdAvailable(
  supabase: SupabaseClient,
  phoneNumberId: string,
  clinicId: string
): Promise<string | null> {
  const normalized = phoneNumberId.trim();
  if (!normalized) return null;

  const { data: rows, error } = await supabase
    .from("clinic_integrations")
    .select("clinic_id, integration_type, metadata, status")
    .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
    .eq("status", "connected");

  if (error) {
    console.warn("[WhatsApp] Falha ao checar phone_number_id único:", error.message);
    return null;
  }

  const conflict = (rows ?? []).find((row) => {
    if (row.clinic_id === clinicId) return false;
    const meta = row.metadata as { phone_number_id?: string } | null;
    const id = typeof meta?.phone_number_id === "string" ? meta.phone_number_id.trim() : "";
    return id === normalized;
  });

  if (conflict) {
    return "Este número WhatsApp já está conectado em outra clínica.";
  }

  return null;
}

export function isUniquePhoneConstraintError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("uq_clinic_integrations_wa_phone_connected") ||
    (m.includes("duplicate key") && m.includes("phone_number_id"))
  );
}
