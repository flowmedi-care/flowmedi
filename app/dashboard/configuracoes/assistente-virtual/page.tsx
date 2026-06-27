import { redirect } from "next/navigation";
import { AssistenteVirtualClient } from "./assistente-virtual-client";
import { getVirtualAssistantPageData } from "./actions";

export default async function AssistenteVirtualPage() {
  const data = await getVirtualAssistantPageData();
  if (data.error) redirect("/dashboard");

  return (
    <AssistenteVirtualClient
        canUse={data.canUse ?? false}
        initialSettings={(data.settings ?? null) as Partial<import("@/lib/virtual-assistant/types").VirtualAssistantSettings> | null}
        initialFaq={data.faq ?? []}
        initialLocations={data.locations ?? []}
        clinic={
          data.clinic
            ? {
                name: data.clinic.name ?? null,
                phone: data.clinic.phone ?? null,
                email: data.clinic.email ?? null,
                address: data.clinic.address ?? null,
                whatsapp_url: data.clinic.whatsapp_url ?? null,
                facebook_url: data.clinic.facebook_url ?? null,
                instagram_url: data.clinic.instagram_url ?? null,
                auto_message_send_start: data.clinic.auto_message_send_start ?? null,
                auto_message_send_end: data.clinic.auto_message_send_end ?? null,
              }
            : null
        }
      />
  );
}
