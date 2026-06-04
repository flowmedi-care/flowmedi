import { Suspense } from "react";
import { getDetailedDre } from "@/lib/financial-reports";
import { parseMonthYear } from "@/lib/financeiro/date-utils";
import { FinanceiroDreClient } from "../financeiro-dre-client";
import { loadFinanceiroAuth } from "../load-financeiro-data";

export default async function FinanceiroDrePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await loadFinanceiroAuth();
  const params = await searchParams;
  const { year, month } = parseMonthYear(params);
  const { data, error } = await getDetailedDre(year, month);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">DRE simplificada</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demonstrativo de resultado por competência — receita faturada no período.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <FinanceiroDreClient report={data} />
        </Suspense>
      )}
    </div>
  );
}
