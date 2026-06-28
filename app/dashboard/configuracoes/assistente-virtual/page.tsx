import { redirect } from "next/navigation";
import { AssistenteVirtualClient } from "./assistente-virtual-client";
import { getVirtualAssistantPageData } from "./actions";

export default async function AssistenteVirtualPage() {
  const data = await getVirtualAssistantPageData();
  if (data.error) redirect("/dashboard");

  return (
    <AssistenteVirtualClient
      canUse={data.canUse ?? false}
      initialSettings={
        (data.settings ?? null) as Partial<
          import("@/lib/virtual-assistant/types").VirtualAssistantSettings
        > | null
      }
      initialFaq={data.faq ?? []}
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
