import { getVendasDashboardMetrics } from "@/lib/vendas-reports";
import { getDefaultFunnelPeriod } from "@/lib/analytics/time-buckets";
import { VendasOverviewClient } from "./vendas-overview-client";

export default async function VendasPage() {
  const period = getDefaultFunnelPeriod();
  const { data, error } = await getVendasDashboardMetrics(period);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Análise comercial baseada em comandas — serviços, materiais e receita faturada.
          Para caixa e contas a receber, use Financeiro.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && <VendasOverviewClient initialMetrics={data} />}
    </div>
  );
}
