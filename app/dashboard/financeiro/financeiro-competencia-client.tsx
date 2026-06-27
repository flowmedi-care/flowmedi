"use client";

import { useMemo } from "react";
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
import { DataTable } from "@/components/dashboard-ui/data-table";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { CompetenceMonthRow } from "@/lib/financeiro/types";
import {
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartLineProps,
  chartTooltipStyle,
  CHART_PALETTE,
} from "@/components/dashboard-ui/chart-theme";

export function FinanceiroCompetenciaClient({ rows }: { rows: CompetenceMonthRow[] }) {
  const latest = rows[rows.length - 1];
  const yoy = useMemo(() => {
    if (!latest) return null;
    const prevYearMonth = `${parseInt(latest.month.slice(0, 4)) - 1}-${latest.month.slice(5)}`;
    const prev = rows.find((r) => r.month === prevYearMonth);
    if (!prev || prev.revenue <= 0) return null;
    return ((latest.revenue - prev.revenue) / prev.revenue) * 100;
  }, [rows, latest]);

  return (
    <div className="space-y-6">
      {latest && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Receita (competência)" value={fmtCurrency(latest.revenue)} subtitle={latest.label} iconColor="primary" />
          <StatCard title="Despesas (competência)" value={fmtCurrency(latest.expenses)} subtitle="Por data de competência/vencimento" />
          <StatCard
            title="Lucro"
            value={fmtCurrency(latest.profit)}
            subtitle={`Margem ${latest.marginPct.toFixed(1)}%${yoy != null ? ` · YoY ${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : ""}`}
            iconColor={latest.profit >= 0 ? "success" : "destructive"}
          />
        </div>
      )}

      <ChartCard title="Receita, despesas e margem" description="P&L por competência mensal">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={rows}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis yAxisId="left" {...chartAxisProps} />
            <YAxis yAxisId="right" orientation="right" {...chartAxisProps} unit="%" />
            <Tooltip {...chartTooltipStyle} formatter={(v: number, name: string) => name === "Margem %" ? `${v.toFixed(1)}%` : fmtCurrency(v)} />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" name="Receita" fill={CHART_PALETTE[0]} {...chartBarProps} />
            <Bar yAxisId="left" dataKey="expenses" name="Despesas" fill={CHART_PALETTE[3]} {...chartBarProps} />
            <Line yAxisId="right" dataKey="marginPct" name="Margem %" stroke={CHART_PALETTE[2]} {...chartLineProps} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <DataTable
        columns={[
          { key: "month", header: "Mês", cell: (r) => r.label },
          { key: "revenue", header: "Receita", className: "text-right", cell: (r) => fmtCurrency(r.revenue) },
          { key: "expenses", header: "Despesas", className: "text-right", cell: (r) => fmtCurrency(r.expenses) },
          {
            key: "profit",
            header: "Lucro",
            className: "text-right font-medium",
            cell: (r) => (
              <span className={r.profit >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtCurrency(r.profit)}</span>
            ),
          },
          { key: "margin", header: "Margem", className: "text-right", cell: (r) => `${r.marginPct.toFixed(1)}%` },
        ]}
        data={rows}
        getRowKey={(r) => r.month}
      />
    </div>
  );
}
