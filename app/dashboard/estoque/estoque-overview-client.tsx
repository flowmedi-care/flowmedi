"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { StockOverviewMetrics } from "@/lib/estoque/analytics";
import {
  CHART_PALETTE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";

export function EstoqueOverviewClient({ metrics }: { metrics: StockOverviewMetrics }) {
  const committedData = [
    { name: "Real", value: metrics.committedReal },
    { name: "Ajustado (no-show)", value: metrics.committedPredicted },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral do estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas, consumo e projeção de estoque comprometido com base no no-show.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Valor em estoque" value={fmtCurrency(metrics.totalValue)} subtitle="Custo × quantidade" iconColor="primary" />
        <StatCard title="Estoque baixo" value={String(metrics.lowStockCount)} subtitle="Produtos abaixo do mínimo" iconColor="warning" />
        <StatCard title="Vencendo em 30d" value={String(metrics.expiringCount)} subtitle="Lotes próximos da validade" iconColor="warning" />
        <StatCard title="Movimentações" value={String(metrics.movementsThisMonth)} subtitle="No mês corrente" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Comprometido real vs predito" description={`Taxa no-show ${metrics.noShowRate.toFixed(1)}% (90d)`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={committedData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="name" {...chartAxisProps} />
              <YAxis {...chartAxisProps} tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()} />
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
