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
          O que foi faturado — e o funil Agendado → Previsto → Faturado.
        </p>
      </div>
      <Suspense fallback={<PageShellSkeleton withTable={false} />}>
        <FinanceiroCompetenciaClient
          rows={data.rows}
          origin={data.origin}
          pipeline={data.pipeline}
        />
      </Suspense>
    </div>
  );
}
