"use client";

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
import { useState } from "react";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHART_PALETTE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import type { FinanceChartData } from "@/lib/financeiro/types";
import { fmtCurrency } from "@/lib/financeiro/format";

type FinanceOverviewChartsProps = {
  data: FinanceChartData;
  showAging?: boolean;
};

export function FinanceOverviewCharts({ data, showAging }: FinanceOverviewChartsProps) {
  const [lens, setLens] = useState<"faturamento" | "fluxo">("fluxo");
  const series = lens === "faturamento" ? data.faturamentoVsDespesas : data.revenueVsExpenses;
  const hasAging = showAging && data.arAging.some((b) => b.amount > 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Evolução</h2>
        <p className="text-sm text-muted-foreground">Como estamos evoluindo no período.</p>
      </div>

      <ChartCard
        title={lens === "faturamento" ? "Faturamento" : "Fluxo de caixa"}
        description={
          lens === "faturamento"
            ? "Valores faturados nas comandas emitidas"
            : "Dinheiro que entrou e saiu de fato"
        }
      >
        <Tabs value={lens} onValueChange={(v) => setLens(v as "faturamento" | "fluxo")}>
          <TabsList>
            <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={series}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis
                {...chartAxisProps}
                tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()}
              />
              <Tooltip {...chartTooltipStyle} formatter={(value: number) => fmtCurrency(value)} />
              <Legend />
              <Bar
                dataKey="revenue"
                name={lens === "faturamento" ? "Faturado" : "Entradas"}
                fill={CHART_PALETTE[0]}
                {...chartBarProps}
              />
              <Bar
                dataKey="expenses"
                name="Saídas"
                fill={CHART_PALETTE[3]}
                {...chartBarProps}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {hasAging && (
        <ChartCard title="A receber por tempo" description="Saldo em aberto por faixa de atraso">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.arAging} layout="vertical">
              <CartesianGrid {...chartGridProps} />
              <XAxis
                type="number"
                {...chartAxisProps}
                tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()}
              />
              <YAxis type="category" dataKey="bucket" width={64} {...chartAxisProps} />
              <Tooltip {...chartTooltipStyle} formatter={(value: number) => fmtCurrency(value)} />
              <Bar dataKey="amount" name="Valor" fill={CHART_PALETTE[4]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </section>
  );
}
