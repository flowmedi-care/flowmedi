"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import {
  CHART_PALETTE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartLineProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import type { FinanceChartData } from "@/lib/financeiro/types";
import { fmtCurrency } from "@/lib/financeiro/format";

type FinanceOverviewChartsProps = {
  data: FinanceChartData;
};

export function FinanceOverviewCharts({ data }: FinanceOverviewChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Receita vs Despesas" description="Movimentação diária no período">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data.revenueVsExpenses}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => fmtCurrency(value)}
            />
            <Legend />
            <Bar dataKey="revenue" name="Receita" fill={CHART_PALETTE[0]} {...chartBarProps} />
            <Bar dataKey="expenses" name="Despesas" fill={CHART_PALETTE[3]} {...chartBarProps} />
            <Line
              dataKey="profit"
              name="Lucro"
              stroke={CHART_PALETTE[2]}
              {...chartLineProps}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Saldo acumulado" description="Fluxo de caixa acumulado">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.cashAccumulated}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => fmtCurrency(value)}
            />
            <Area
              type="monotone"
              dataKey="balance"
              name="Saldo"
              stroke={CHART_PALETTE[0]}
              fill={CHART_PALETTE[0]}
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Mix de despesas" description="Distribuição por categoria">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data.expenseMix}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.expenseMix.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => fmtCurrency(value)}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Contas a receber — aging" description="Saldo em aberto por faixa">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.arAging}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="bucket" {...chartAxisProps} />
            <YAxis {...chartAxisProps} tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => fmtCurrency(value)}
            />
            <Bar dataKey="amount" name="Valor" fill={CHART_PALETTE[4]} {...chartBarProps} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Projeção estratégica"
        description="Cenário real vs ajustado (no-show + recorrências)"
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data.projection}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} />
            <Tooltip {...chartTooltipStyle} />
            <Legend />
            <Line
              dataKey="real"
              name="Real"
              stroke={CHART_PALETTE[0]}
              {...chartLineProps}
            />
            <Line
              dataKey="projected"
              name="Projetado"
              stroke={CHART_PALETTE[2]}
              strokeDasharray="5 5"
              {...chartLineProps}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
