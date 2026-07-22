import { redirect } from "next/navigation";

/** Rota legada — Princípio Zero: levar ao posto de trabalho (Jornada). */
export default function PipelineRedirectPage() {
  redirect("/dashboard/crm/jornada?view=pendencias");
}
