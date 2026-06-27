import { redirect } from "next/navigation";

export default function FinanceiroFluxoDiarioRedirect() {
  redirect("/dashboard/financeiro/fluxo-caixa");
}
