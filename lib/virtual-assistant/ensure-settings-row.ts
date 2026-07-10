import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garante que existe uma linha em clinic_virtual_assistant_settings para a clínica.
 * Usar service role após validar admin no server action.
 */
export async function ensureVirtualAssistantSettingsRow(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error: readError } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("clinic_id")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }
  if (data?.clinic_id) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("clinic_virtual_assistant_settings").insert({
    clinic_id: clinicId,
    enabled: false,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: true };
    }
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}
