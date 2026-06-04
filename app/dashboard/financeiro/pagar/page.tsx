import { FinanceiroPagarClient } from "../financeiro-pagar-client";
import { loadFinanceiroPagar } from "../load-financeiro-data";

export default async function FinanceiroPagarPage() {
  const data = await loadFinanceiroPagar();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Contas a pagar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Despesas pendentes agrupadas por vencimento — lente AP.
        </p>
      </div>
      <FinanceiroPagarClient
        expenses={data.expenses}
        suppliers={data.suppliers}
        canManage={data.canManage}
      />
    </div>
  );
}
