import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfirmationFlowConfig = {
  flowId: string;
  templateName: string;
  enabled: boolean;
};

const DEFAULT_TEMPLATE_NAME = "flowmedi_confirmacao_flow";

export async function getConfirmationFlowConfig(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ConfirmationFlowConfig | null> {
  const { data } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("confirmation_flow_id, confirmation_flow_template_name")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const flowId =
    (data?.confirmation_flow_id && String(data.confirmation_flow_id).trim()) ||
    process.env.META_WHATSAPP_CONFIRMATION_FLOW_ID?.trim() ||
    "";

  if (!flowId) return null;

  const templateName =
    (data?.confirmation_flow_template_name &&
      String(data.confirmation_flow_template_name).trim()) ||
    process.env.META_WHATSAPP_CONFIRMATION_FLOW_TEMPLATE?.trim() ||
    DEFAULT_TEMPLATE_NAME;

  return {
    flowId,
    templateName,
    enabled: true,
  };
}

export function isConfirmationFlowEvent(eventCode: string): boolean {
  return (
    eventCode === "appointment_confirmation_request" ||
    eventCode === "appointment_confirmation_followup"
  );
}
