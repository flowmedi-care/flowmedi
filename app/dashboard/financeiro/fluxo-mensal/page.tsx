import { redirect } from "next/navigation";

export default function FinanceiroFluxoMensalRedirect() {
  redirect("/dashboard/financeiro/fluxo-caixa");
}
