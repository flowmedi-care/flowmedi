import { redirect } from "next/navigation";

export default function PlanosTratamentoPage() {
  redirect("/dashboard/servicos-valores/servicos?tab=planos");
}
