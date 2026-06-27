import { Suspense } from "react";
import { getDetailedDre } from "@/lib/financial-reports";
import { parseMonthYear } from "@/lib/financeiro/date-utils";
import { getClinicFinancialSettings } from "@/lib/financeiro/analytics";
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
  const [{ data, error }, { settings }] = await Promise.all([
    getDetailedDre(year, month),
    getClinicFinancialSettings(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">DRE</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demonstrativo completo — receita, CMV, EBITDA, PECLD, LAIR e resultado líquido.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <FinanceiroDreClient report={data} initialSettings={settings} />
        </Suspense>
      )}
    </div>
  );
}
