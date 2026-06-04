import { FinanceiroClient } from "../financeiro-client";
import { loadFinanceiroPageData } from "../load-financeiro-data";

export default async function FinanceiroPagarPage() {
  const { error, entries, summary, openComandas, canManage } = await loadFinanceiroPageData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Contas a pagar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Despesas pendentes e pagas da clínica.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <FinanceiroClient
        initialEntries={entries}
        summary={summary}
        openComandas={openComandas}
        canManage={canManage}
        section="pagar"
      />
    </div>
  );
}
