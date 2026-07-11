import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClinicFlowConfig } from "@/lib/attendance-flow/load-clinic-flow-config";
import type { ClinicFlowConfig } from "@/lib/attendance-flow/flow-sync";
import type { CustomFieldForGoals } from "@/lib/attendance-flow/types";

export type PolicySlice = ClinicFlowConfig & {
  customFields: CustomFieldForGoals[];
};

export async function loadPolicySlice(
  supabase: SupabaseClient,
  clinicId: string
): Promise<PolicySlice> {
  const { flowConfig, customFields } = await loadClinicFlowConfig(supabase, clinicId);
  return { ...flowConfig, customFields };
}
