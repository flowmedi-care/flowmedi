import { Suspense } from "react";
import { FinanceiroOverviewClient } from "./financeiro-overview-client";
import { loadFinanceiroOverview } from "./load-financeiro-data";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await loadFinanceiroOverview(params);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral — receita faturada (competência), entradas no caixa e contas a receber/pagar.
        </p>
      </div>
      {data.error && <p className="text-sm text-destructive">{data.error}</p>}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <FinanceiroOverviewClient
          year={data.year}
          month={data.month}
          metrics={data.metrics}
          openComandas={data.openComandas}
          suppliers={data.suppliers}
          canManage={data.canManage}
          userRole={data.userRole}
        />
      </Suspense>
    </div>
  );
}
