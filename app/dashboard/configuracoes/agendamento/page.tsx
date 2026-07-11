import { redirect } from "next/navigation";
import { getAgendamentoPolicyPageData } from "./actions";
import { AgendamentoPolicyClient } from "./agendamento-policy-client";

export default async function AgendamentoPolicyPage() {
  const data = await getAgendamentoPolicyPageData();
  if (data.error || !data.policy) redirect("/dashboard");

  return <AgendamentoPolicyClient initialPolicy={data.policy} />;
}
