import { getCompetenceByMonth } from "@/lib/financial-reports";
import { FinanceiroReportClient } from "../financeiro-report-client";

export default async function FinanceiroCompetenciaPage() {
  const { data, error } = await getCompetenceByMonth(12);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <FinanceiroReportClient
        title="Relatório de competência"
        subtitle="Receita faturada por mês — comandas fechadas ou pagas (lente Competência)."
        rows={(data ?? []).map((r) => ({
          periodo: r.label,
          receita: r.revenue,
        }))}
        columns={[
          { key: "periodo", label: "Período" },
          { key: "receita", label: "Receita faturada", format: "currency" },
        ]}
      />
    </>
  );
}
