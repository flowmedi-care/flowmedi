import { getCashFlowDaily } from "@/lib/financial-reports";
import { FinanceiroReportClient } from "../financeiro-report-client";

export default async function FinanceiroFluxoDiarioPage() {
  const { data, error } = await getCashFlowDaily(30);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <FinanceiroReportClient
        title="Fluxo de caixa diário"
        subtitle="Entradas (pagamentos de pacientes) e saídas (despesas pagas) por dia — últimos 30 dias."
        rows={(data ?? []).map((r) => ({
          data: new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR"),
          entradas: r.inflow,
          saidas: r.outflow,
          saldo: r.inflow - r.outflow,
        }))}
        columns={[
          { key: "data", label: "Data" },
          { key: "entradas", label: "Entradas", format: "currency" },
          { key: "saidas", label: "Saídas", format: "currency" },
          { key: "saldo", label: "Saldo", format: "currency" },
        ]}
      />
    </>
  );
}
