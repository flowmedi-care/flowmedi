import { Suspense } from "react";
import { FinanceiroExtratoClient } from "../financeiro-extrato-client";
import { loadFinanceiroExtrato } from "../load-financeiro-data";

export default async function FinanceiroExtratoPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await loadFinanceiroExtrato(params);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Extrato</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Movimentações unificadas com origem, saldo acumulado e comprovantes Flowmedi.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <FinanceiroExtratoClient
          year={data.year}
          month={data.month}
          ledger={data.ledger}
          suppliers={data.suppliers}
        />
      </Suspense>
    </div>
  );
}
