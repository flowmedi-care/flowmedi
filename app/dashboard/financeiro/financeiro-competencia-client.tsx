"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { CompetenceMonthRow, RevenueOriginRow } from "@/lib/financeiro/types";
import type { ForecastResult } from "@/lib/business-pipeline/types";
import { FinancePipelineFunnel } from "./components/finance-pipeline-funnel";
import {
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
  MONO_CHART_SCALE,
} from "@/components/dashboard-ui/chart-theme";

/** Faixas de fundo alternadas por mês */
const MONTH_BAND_EVEN = "hsl(var(--primary))";
const MONTH_BAND_ODD = "hsl(var(--muted))";

export function FinanceiroCompetenciaClient({
  rows,
  origin,
  pipeline,
}: {
  rows: CompetenceMonthRow[];
  origin: RevenueOriginRow[];
  pipeline: ForecastResult | null;
}) {
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
      {pipeline && <FinancePipelineFunnel forecast={pipeline} mode="competencia" />}

      {latest && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Receita faturada"
            value={fmtCurrency(latest.revenue)}
            subtitle={latest.label}
            iconColor="primary"
          />
          <StatCard
            title="Despesas"
            value={fmtCurrency(latest.expenses)}
            subtitle="Por competência / vencimento"
          />
          <StatCard
            title="Lucro"
            value={fmtCurrency(latest.profit)}
            subtitle={`Margem ${latest.marginPct.toFixed(1)}%${yoy != null ? ` · YoY ${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : ""}`}
            iconColor={latest.profit >= 0 ? "success" : "destructive"}
          />
        </div>
      )}

      <ChartCard title="Receita, despesas e lucro" description="Como faturamos mês a mês">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} barCategoryGap="18%">
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis
              {...chartAxisProps}
              tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()}
            />
            <Tooltip {...chartTooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
            <Legend />
            {rows.map((row, i) => (
              <ReferenceArea
                key={row.month}
                x1={row.label}
                x2={row.label}
                fill={i % 2 === 0 ? MONTH_BAND_EVEN : MONTH_BAND_ODD}
                fillOpacity={i % 2 === 0 ? 0.07 : 0.55}
                strokeOpacity={0}
              />
            ))}
            <Bar dataKey="revenue" name="Receita" fill={MONO_CHART_SCALE[0]} {...chartBarProps} />
            <Bar dataKey="expenses" name="Despesas" fill={MONO_CHART_SCALE[3]} {...chartBarProps} />
            <Bar dataKey="profit" name="Lucro" fill={MONO_CHART_SCALE[1]} {...chartBarProps} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {origin.length > 0 && (
        <ChartCard title="Origem da receita" description="De onde veio o faturamento (últimos meses)">
          <ResponsiveContainer width="100%" height={Math.max(220, origin.length * 40)}>
            <BarChart data={origin} layout="vertical">
              <CartesianGrid {...chartGridProps} />
              <XAxis
                type="number"
                {...chartAxisProps}
                tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()}
              />
              <YAxis type="category" dataKey="name" width={110} {...chartAxisProps} />
              <Tooltip {...chartTooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
              <Bar dataKey="value" name="Valor" fill={MONO_CHART_SCALE[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

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
              <span className={r.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                {fmtCurrency(r.profit)}
              </span>
            ),
          },
          {
            key: "margin",
            header: "Margem",
            className: "text-right",
            cell: (r) => `${r.marginPct.toFixed(1)}%`,
          },
        ]}
        data={rows}
        getRowKey={(r) => r.month}
      />
    </div>
  );
}
