import { FinanceiroPerformanceClient } from "../financeiro-performance-client";
import { loadFinanceiroPerformance } from "../load-financeiro-data";

export default async function FinanceiroPerformancePage() {
  const data = await loadFinanceiroPerformance();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estamos melhores que o período anterior?
        </p>
      </div>
      {data.error && <p className="text-sm text-destructive">{data.error}</p>}
      <FinanceiroPerformanceClient metrics={data.metrics} />
    </div>
  );
}
