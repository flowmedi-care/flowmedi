import { getStockOverviewMetrics, listStockCategories } from "@/lib/estoque/analytics";
import { EstoqueOverviewClient } from "./estoque-overview-client";

export default async function EstoquePage() {
  const [{ data, error }, { data: categories }] = await Promise.all([
    getStockOverviewMetrics(),
    listStockCategories(),
  ]);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {data && <EstoqueOverviewClient metrics={data} categories={categories ?? []} />}
    </>
  );
}
