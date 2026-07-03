import { Suspense } from "react";
import { FinanceiroCompetenciaClient } from "../financeiro-competencia-client";
import { loadFinanceiroCompetencia } from "../load-financeiro-data";
import { PageShellSkeleton } from "@/components/dashboard-ui/loading/page-shell-skeleton";

export default async function FinanceiroCompetenciaPage() {
  const data = await loadFinanceiroCompetencia();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Competência</h1>
        <p className="text-sm text-muted-foreground mt-1">
          P&L por competência — receitas, despesas e lucro mensal.
        </p>
      </div>
      <Suspense fallback={<PageShellSkeleton withTable={false} />}>
        <FinanceiroCompetenciaClient rows={data.rows} />
      </Suspense>
    </div>
  );
}
