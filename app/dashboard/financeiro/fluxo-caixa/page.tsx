import { Suspense } from "react";
import { FinanceiroFluxoCaixaClient } from "../financeiro-fluxo-caixa-client";
import { loadFinanceiroFluxoCaixa } from "../load-financeiro-data";
import { PageShellSkeleton } from "@/components/dashboard-ui/loading/page-shell-skeleton";

export default async function FinanceiroFluxoCaixaPage() {
  const data = await loadFinanceiroFluxoCaixa();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Fluxo de caixa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entradas e saídas com granularidade livre, gráficos e origem de cada movimentação.
        </p>
      </div>
      <Suspense fallback={<PageShellSkeleton withTable={false} />}>
        <FinanceiroFluxoCaixaClient
          initialPeriod={data.period}
          initialBuckets={data.buckets}
          initialRows={data.rows}
        />
      </Suspense>
    </div>
  );
}
