import type { SupabaseClient } from "@supabase/supabase-js";

const PERMANENT_FLOW_ERROR_PATTERNS = [
  /verif/i,
  /not eligible/i,
  /n[aã]o [eé] eleg[ií]vel/i,
  /business.*not/i,
  /empresa.*n[aã]o/i,
  /cannot publish/i,
  /n[aã]o.*public/i,
  /flows? (are )?not (available|supported)/i,
  /flows?.*indispon/i,
  /flow.*disabled/i,
  /template.*not.*approved/i,
  /template.*does not exist/i,
  /132001/i,
];

export function shouldDisableConfirmationFlow(error?: string | null): boolean {
  const msg = String(error || "").trim();
  if (!msg) return false;
  return PERMANENT_FLOW_ERROR_PATTERNS.some((pattern) => pattern.test(msg));
}

export async function disableConfirmationFlowForClinic(
  supabase: SupabaseClient,
  clinicId: string
): Promise<void> {
  await supabase
    .from("clinic_virtual_assistant_settings")
    .update({ confirmation_flow_id: null })
    .eq("clinic_id", clinicId);
}

export const CONFIRMATION_FLOW_FALLBACK_TEMPLATE = "flowmedi_consulta";
