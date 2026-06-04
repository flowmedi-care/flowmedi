import { getSimpleDre } from "@/lib/financial-reports";
import { Card, CardContent } from "@/components/ui/card";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function FinanceiroDrePage() {
  const { data, error } = await getSimpleDre(1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">DRE simplificada</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demonstrativo resumido do último mês (receita de comandas − despesas pagas).
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span>Receita bruta (comandas)</span>
              <span className="font-medium text-green-700 dark:text-green-400">
                {fmt(data.receitaBruta)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>Despesas operacionais</span>
              <span className="font-medium">{fmt(data.despesasOperacionais)}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold text-lg">
              <span>Resultado</span>
              <span className={data.resultado >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}>
                {fmt(data.resultado)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
