import { getVendasOverview } from "@/lib/vendas-reports";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function VendasPage() {
  const { data, error } = await getVendasOverview(30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral baseada em comandas (fonte operacional com serviços e materiais).
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total vendido (30d)</p>
                <p className="text-2xl font-semibold">{fmt(data.totalVendas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Comandas</p>
                <p className="text-2xl font-semibold">{data.count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Ticket médio</p>
                <p className="text-2xl font-semibold">{fmt(data.ticketMedio)}</p>
              </CardContent>
            </Card>
          </div>
          {data.topServicos.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-3">Serviços mais vendidos</p>
                <ul className="space-y-2 text-sm">
                  {data.topServicos.map((s) => (
                    <li key={s.name} className="flex justify-between">
                      <span>{s.name}</span>
                      <span className="font-medium">{fmt(s.total)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Link href="/dashboard/vendas/relatorio">
            <Button>Relatório detalhado</Button>
          </Link>
        </>
      )}
    </div>
  );
}
