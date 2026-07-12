import { redirect } from "next/navigation";
import { AssistenteVirtualClient } from "./assistente-virtual-client";
import { getVirtualAssistantPageData } from "./actions";
import { getAgendamentoPolicyPageData } from "../agendamento/actions";
import { ASSISTANT_TOOLS } from "@/lib/virtual-assistant/tools/definitions";
import { mergeAppointmentPolicy, mergeConversationFlows } from "@/lib/attendance-flow/defaults";

export default async function AssistenteVirtualPage() {
  const data = await getVirtualAssistantPageData();
  if (data.error) redirect("/dashboard");

  const policyData = await getAgendamentoPolicyPageData();
  const appointmentPolicy = mergeAppointmentPolicy(policyData.policy ?? null);

  const conversationFlows = mergeConversationFlows(
    (data.settings?.conversation_flows as import("@/lib/attendance-flow/types").ConversationFlowsConfig | null) ??
      null
  );

  return (
    <AssistenteVirtualClient
      canUse={data.canUse ?? false}
      initialSettings={
        (data.settings ?? null) as Partial<
          import("@/lib/virtual-assistant/types").VirtualAssistantSettings
        > | null
      }
      initialFaq={data.faq ?? []}
      toolDefinitions={ASSISTANT_TOOLS}
      initialConversationFlows={conversationFlows}
      initialAppointmentPolicy={appointmentPolicy}
      clinic={
        data.clinic
          ? {
              auto_message_send_start: data.clinic.auto_message_send_start ?? null,
              auto_message_send_end: data.clinic.auto_message_send_end ?? null,
            }
          : null
      }
    />
  );
}
