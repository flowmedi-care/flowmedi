import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantSettings } from "./types";
import {
  buildKnowledgePackage,
  buildPromptFromPackage,
  mergeFinanceActions,
  mergeKnowledgeAcl,
  resolveEnabledCapabilities,
} from "@/lib/assistant-platform";
import { mergeAppointmentPolicy } from "@/lib/attendance-flow/defaults";
import type { AppointmentPolicyInput } from "@/lib/attendance-flow/types";
import { mergeConversationFlows } from "@/lib/attendance-flow/defaults";

/**
 * Clinic facts for the LLM — routed through Information Sources + Knowledge Package + Prompt Builder.
 */
export async function buildClinicContext(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ text: string; clinicName: string; settings: Partial<VirtualAssistantSettings> }> {
  const [{ data: clinic }, { data: settings }] = await Promise.all([
    supabase.from("clinics").select("name, appointment_policy").eq("id", clinicId).single(),
    supabase.from("clinic_virtual_assistant_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
  ]);

  const s = (settings ?? {}) as Partial<VirtualAssistantSettings>;
  const policy = mergeAppointmentPolicy(
    (clinic?.appointment_policy ?? null) as AppointmentPolicyInput | null
  );
  const flows = mergeConversationFlows(
    (s.conversation_flows as Parameters<typeof mergeConversationFlows>[0]) ?? null
  );

  const consulta = flows.workflows.consulta;
  const cancelamento = flows.workflows.cancelamento;
  const reschedule = flows.workflows.reschedule;

  const capabilities = resolveEnabledCapabilities({
    knowledgeAcl: mergeKnowledgeAcl(policy.knowledge_acl),
    financeActions: mergeFinanceActions(policy.finance_actions),
    allowBooking: consulta?.enabled !== false,
    allowCancel: cancelamento?.enabled !== false,
    allowReschedule: reschedule?.enabled !== false,
    checkInEnabled: policy.check_in.enabled,
    humanHandoffEnabled: s.human_handoff_enabled !== false,
  });

  const pkg = await buildKnowledgePackage({
    loadCtx: { clinicId, supabase },
    knowledgeAcl: policy.knowledge_acl,
    capabilities,
  });

  // Keep doctors in prompt for booking (loaded lightly outside sources for now)
  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name, specialty")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  const doctorLines = (doctors ?? []).map(
    (d: { full_name: string; specialty: string | null; id: string }) =>
      `- ${d.full_name}${d.specialty ? ` (${d.specialty})` : ""} [doctor_id: ${d.id}]`
  );

  let text = buildPromptFromPackage({
    clinicName: clinic?.name ?? "clínica",
    package: pkg,
    capabilities,
  });

  if (doctorLines.length) {
    text = `${text}\n\n# Profissionais\n${doctorLines.join("\n")}`;
  }

  return {
    text,
    clinicName: clinic?.name ?? "clínica",
    settings: s,
  };
}
