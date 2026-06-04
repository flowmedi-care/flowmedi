import { FinanceiroReceberClient } from "../financeiro-receber-client";
import { loadFinanceiroReceber } from "../load-financeiro-data";

export default async function FinanceiroReceberPage() {
  const data = await loadFinanceiroReceber();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Contas a receber</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cupons em aberto e receitas manuais pendentes — seções separadas.
        </p>
      </div>
      <FinanceiroReceberClient
        openComandas={data.openComandas}
        manualReceitas={data.manualReceitas}
        canManage={data.canManage}
        userRole={data.userRole}
      />
    </div>
  );
}
