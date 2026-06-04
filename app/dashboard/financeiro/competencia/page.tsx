import { getCompetenceByMonth } from "@/lib/financial-reports";
import { FinanceiroReportClient } from "../financeiro-report-client";

export default async function FinanceiroCompetenciaPage() {
  const { data, error } = await getCompetenceByMonth(12);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <FinanceiroReportClient
        title="Relatório de competência"
        subtitle="Receita reconhecida por mês com base nas comandas (valor total faturado)."
        rows={(data ?? []).map((r) => ({
          periodo: r.label,
          receita: r.revenue,
        }))}
        columns={[
          { key: "periodo", label: "Período" },
          { key: "receita", label: "Receita", format: "currency" },
        ]}
      />
    </>
  );
}
