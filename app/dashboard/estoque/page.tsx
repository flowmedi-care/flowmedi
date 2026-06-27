import { getStockOverviewMetrics } from "@/lib/estoque/analytics";
import { EstoqueOverviewClient } from "./estoque-overview-client";

export default async function EstoquePage() {
  const { data, error } = await getStockOverviewMetrics();

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {data && <EstoqueOverviewClient metrics={data} />}
    </>
  );
}
