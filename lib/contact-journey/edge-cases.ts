import type { SupabaseClient } from "@supabase/supabase-js";

/** Normaliza telefone para comparação (últimos 8 dígitos + DDD). */
export function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-11) || digits;
}

/**
 * Evita pipeline duplicado quando mesmo contato usa outro número.
 * Retorna pipeline existente se CPF ou nome+telefone similar.
 */
export async function findDuplicatePipeline(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string,
  email?: string | null
): Promise<string | null> {
  if (email) {
    const { data } = await supabase
      .from("non_registered_pipeline")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const key = normalizePhoneKey(phone);
  const { data: leads } = await supabase
    .from("non_registered_pipeline")
    .select("id, phone")
    .eq("clinic_id", clinicId);

  const match = (leads ?? []).find((l) => {
    const pKey = normalizePhoneKey(String(l.phone ?? ""));
    return pKey && key && pKey.slice(-8) === key.slice(-8);
  });

  return match?.id ?? null;
}

export function pickFocusedAppointment<T extends { id: string; scheduled_at: string }>(
  appointments: T[],
  focusedId?: string | null
): T | null {
  if (!appointments.length) return null;
  if (focusedId) {
    return appointments.find((a) => a.id === focusedId) ?? appointments[0];
  }
  const future = appointments
    .filter((a) => new Date(a.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return future[0] ?? appointments[0];
}

export function isOutsideBusinessHours(
  now: Date,
  startHour = 8,
  endHour = 18
): boolean {
  const h = now.getHours();
  return h < startHour || h >= endHour;
}
