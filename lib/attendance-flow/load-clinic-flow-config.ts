import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeClinicFlowConfig, type ClinicFlowConfig } from "@/lib/attendance-flow/flow-sync";
import type { CustomFieldForGoals } from "@/lib/attendance-flow/types";

export async function loadClinicFlowConfig(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ flowConfig: ClinicFlowConfig; customFields: CustomFieldForGoals[] }> {
  const [{ data: clinic }, { data: va }, { data: customFieldsRaw }] = await Promise.all([
    supabase.from("clinics").select("appointment_policy").eq("id", clinicId).maybeSingle(),
    supabase
      .from("clinic_virtual_assistant_settings")
      .select("conversation_flows")
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    supabase
      .from("patient_custom_fields")
      .select("id, field_name, field_label, whatsapp_policy, display_order")
      .eq("clinic_id", clinicId)
      .neq("whatsapp_policy", "ignore")
      .order("display_order"),
  ]);

  const flowConfig = mergeClinicFlowConfig({
    appointment_policy: clinic?.appointment_policy as ClinicFlowConfig["appointmentPolicy"],
    conversation_flows: va?.conversation_flows as ClinicFlowConfig["conversationFlows"],
  });

  const customFields: CustomFieldForGoals[] = (customFieldsRaw ?? []).map((f) => ({
    id: String(f.id),
    field_name: String(f.field_name),
    field_label: String(f.field_label),
    whatsapp_policy: (f.whatsapp_policy ?? "ignore") as CustomFieldForGoals["whatsapp_policy"],
    display_order: Number(f.display_order ?? 0),
  }));

  return { flowConfig, customFields };
}
