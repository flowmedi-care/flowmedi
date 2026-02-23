import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertAuditLog(
  supabase: SupabaseClient,
  params: {
    clinic_id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    old_values?: Record<string, unknown> | null;
    new_values?: Record<string, unknown> | null;
  }
) {
  await supabase.from("audit_log").insert({
    clinic_id: params.clinic_id,
    user_id: params.user_id,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    old_values: params.old_values ?? null,
    new_values: params.new_values ?? null,
  });
}
