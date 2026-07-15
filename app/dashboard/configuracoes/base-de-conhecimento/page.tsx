import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { getVirtualAssistantPageData } from "../assistente-virtual/actions";
import { BaseDeConhecimentoClient } from "./base-de-conhecimento-client";

export default async function BaseDeConhecimentoPage() {
  const data = await getVirtualAssistantPageData();
  if (data.error) redirect("/dashboard");

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Base de conhecimento" }],
        title: "Base de conhecimento",
        description:
          "Fonte da verdade para respostas frequentes. O Assistente Virtual apenas decide se a IA pode consultar esta base.",
      }}
    >
      <BaseDeConhecimentoClient initialEntries={data.faq ?? []} />
    </PageShell>
  );
}
