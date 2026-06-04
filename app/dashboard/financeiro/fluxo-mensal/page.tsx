import { getCashFlowMonthly } from "@/lib/financial-reports";
import { FinanceiroReportClient } from "../financeiro-report-client";

export default async function FinanceiroFluxoMensalPage() {
  const { data, error } = await getCashFlowMonthly(12);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <FinanceiroReportClient
        title="Fluxo de Caixa — Movimento Real (mensal)"
        subtitle="Entradas no caixa (pagamentos de pacientes) e saídas (despesas pagas)."
        rows={(data ?? []).map((r) => ({
          mes: r.label,
          entradas: r.inflow,
          saidas: r.outflow,
          saldo: r.inflow - r.outflow,
        }))}
        columns={[
          { key: "mes", label: "Mês" },
          { key: "entradas", label: "Entradas", format: "currency" },
          { key: "saidas", label: "Saídas", format: "currency" },
          { key: "saldo", label: "Saldo", format: "currency" },
        ]}
      />
    </>
  );
}
