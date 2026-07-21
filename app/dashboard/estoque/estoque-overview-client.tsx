"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { StockCategoryRow, StockOverviewMetrics } from "@/lib/estoque/analytics";
import {
  CHART_PALETTE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import { Package } from "lucide-react";

export function EstoqueOverviewClient({
  metrics,
  categories,
}: {
  metrics: StockOverviewMetrics;
  categories: StockCategoryRow[];
}) {
  const committedData = [
    { name: "Real", value: metrics.committedReal },
    { name: "Ajustado (no-show)", value: metrics.committedPredicted },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral do estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Categorias, alertas e consumo.
        </p>
      </div>

      {categories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Categorias
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/dashboard/estoque/c/${cat.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Package className="h-4 w-4" />
                        </div>
                        <p className="font-semibold truncate">{cat.name}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cat.product_count} produto{cat.product_count === 1 ? "" : "s"}
                    </p>
                    {cat.low_stock_count > 0 ? (
                      <Badge variant="warning">Baixo estoque: {cat.low_stock_count}</Badge>
                    ) : (
                      <Badge variant="secondary">Sem alertas</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Valor em estoque"
          value={fmtCurrency(metrics.totalValue)}
          subtitle="Custo × quantidade"
          iconColor="primary"
        />
        <StatCard
          title="Estoque baixo"
          value={String(metrics.lowStockCount)}
          subtitle="Produtos abaixo do mínimo"
          iconColor="warning"
        />
        <StatCard
          title="Vencendo em 30d"
          value={String(metrics.expiringCount)}
          subtitle="Lotes próximos da validade"
          iconColor="warning"
        />
        <StatCard
          title="Movimentações"
          value={String(metrics.movementsThisMonth)}
          subtitle="No mês corrente"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Comprometido real vs predito"
          description={`Taxa no-show ${metrics.noShowRate.toFixed(1)}% (90d)`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={committedData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="name" {...chartAxisProps} />
              <YAxis
                {...chartAxisProps}
                tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()}
              />
              <Tooltip {...chartTooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
              <Bar dataKey="value" fill={CHART_PALETTE[0]} {...chartBarProps} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 consumo" description="Produtos mais consumidos">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.topConsumption} layout="vertical">
              <CartesianGrid {...chartGridProps} />
              <XAxis type="number" {...chartAxisProps} />
              <YAxis type="category" dataKey="name" width={100} {...chartAxisProps} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="quantity" fill={CHART_PALETTE[2]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Entradas vs saídas" description="Últimos 6 meses">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={metrics.inOutByMonth}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} />
            <Tooltip {...chartTooltipStyle} />
            <Legend />
            <Bar dataKey="inflow" name="Entradas" fill={CHART_PALETTE[0]} {...chartBarProps} />
            <Bar dataKey="outflow" name="Saídas" fill={CHART_PALETTE[3]} {...chartBarProps} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
