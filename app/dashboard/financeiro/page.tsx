import { Suspense } from "react";
import { FinanceiroOverviewClient } from "./financeiro-overview-client";
import { loadFinanceiroOverview } from "./load-financeiro-data";
import { PageShellSkeleton } from "@/components/dashboard-ui/loading/page-shell-skeleton";

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
          Sua caixa de entrada — o que precisa ser feito agora.
        </p>
      </div>
      {data.error && <p className="text-sm text-destructive">{data.error}</p>}
      <Suspense fallback={<PageShellSkeleton withTable={false} />}>
        <FinanceiroOverviewClient
          briefing={data.briefing}
          indicators={data.indicators}
          chartData={data.chartData}
          cobrar={data.cobrar}
          receber={data.receber}
          recebido={data.recebido}
          suppliers={data.suppliers}
          canManage={data.canManage}
        />
      </Suspense>
    </div>
  );
}
