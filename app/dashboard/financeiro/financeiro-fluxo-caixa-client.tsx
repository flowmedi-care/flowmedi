"use client";

import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/dashboard-ui/filters/period-filter";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { ToolbarContextBadge } from "@/components/dashboard-ui/toolbar/toolbar-context-badge";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtCurrency, downloadCsv } from "@/lib/financeiro/format";
import { getCashFlowUnified } from "@/lib/financeiro/analytics";
import type { CashFlowBucket, UnifiedLedgerRow } from "@/lib/financeiro/types";
import type { FunnelPeriod, TimeGranularity } from "@/lib/analytics/time-buckets";
import {
  CHART_PALETTE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartLineProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";

export function FinanceiroFluxoCaixaClient({
  initialPeriod,
  initialBuckets,
  initialRows,
}: {
  initialPeriod: FunnelPeriod;
  initialBuckets: CashFlowBucket[];
  initialRows: UnifiedLedgerRow[];
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [buckets, setBuckets] = useState(initialBuckets);
  const [rows, setRows] = useState(initialRows);
  const [chartMode, setChartMode] = useState<"fluxo" | "acumulado">("fluxo");
  const [isPending, startTransition] = useTransition();

  const reload = (next: FunnelPeriod) => {
    setPeriod(next);
    startTransition(async () => {
      const res = await getCashFlowUnified(next);
      if (!res.error) {
        setBuckets(res.buckets);
        setRows(res.rows);
      }
    });
  };

  const handlePeriodChange = (next: FunnelPeriod) => {
    reload({ ...next, granularity: period.granularity });
  };

  const handleGranularity = (g: TimeGranularity) => {
    reload({ ...period, granularity: g });
  };

  const chartData = buckets.map((b) => ({
    ...b,
    outflowNeg: -b.outflow,
  }));

  function exportCsv() {
    downloadCsv(`fluxo-caixa-${period.start}-${period.end}.csv`, [
      ["Data", "Contraparte", "Tipo", "Descrição", "Origem", "Valor", "Saldo"],
      ...rows.map((r) => [
        new Date(r.occurred_at).toLocaleString("pt-BR"),
        r.counterparty,
        r.type === "inflow" ? "Entrada" : "Saída",
        r.description,
        r.source_label,
        String(r.type === "inflow" ? r.amount : -r.amount),
        String(r.running_balance),
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <PageToolbar>
        <PageToolbar.Filters>
          <PeriodFilter
            mode="range"
            value={period}
            onChange={handlePeriodChange}
            actions={
              <Button
                variant="outline"
                size="sm"
                className="h-10 shadow-none"
                onClick={exportCsv}
                disabled={isPending}
              >
                Exportar CSV
              </Button>
            }
          />
        </PageToolbar.Filters>
        <PageToolbar.Meta>
          <ToolbarContextBadge>
            {isPending ? "Atualizando…" : "Como o dinheiro entrou e saiu"}
          </ToolbarContextBadge>
        </PageToolbar.Meta>
      </PageToolbar>

      <ChartCard
        title="Fluxo de caixa"
        description="Entradas acima · saídas abaixo · líquido na linha"
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Tabs
            value={period.granularity}
            onValueChange={(v) => handleGranularity(v as TimeGranularity)}
          >
            <TabsList>
              <TabsTrigger value="day">Diário</TabsTrigger>
              <TabsTrigger value="week">Semanal</TabsTrigger>
              <TabsTrigger value="month">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={chartMode} onValueChange={(v) => setChartMode(v as "fluxo" | "acumulado")}>
            <TabsList>
              <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
              <TabsTrigger value="acumulado">Acumulado</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {chartMode === "fluxo" ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} stackOffset="sign">
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis
                {...chartAxisProps}
                tickFormatter={(v) => fmtCurrency(Math.abs(v)).replace("R$", "").trim()}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(v: number, name: string) => [
                  fmtCurrency(Math.abs(v)),
                  name === "outflowNeg" ? "Saídas" : name,
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "outflowNeg" ? "Saídas" : value === "inflow" ? "Entradas" : "Líquido"
                }
              />
              <Bar dataKey="inflow" name="Entradas" fill={CHART_PALETTE[0]} {...chartBarProps} />
              <Bar dataKey="outflowNeg" name="Saídas" fill={CHART_PALETTE[3]} {...chartBarProps} />
              <Line dataKey="net" name="Líquido" stroke={CHART_PALETTE[2]} {...chartLineProps} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={buckets}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis
                {...chartAxisProps}
                tickFormatter={(v) => fmtCurrency(v).replace("R$", "").trim()}
              />
              <Tooltip {...chartTooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Acumulado"
                stroke={CHART_PALETTE[0]}
                fill={CHART_PALETTE[0]}
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <DataTable
        columns={[
          {
            key: "date",
            header: "Data",
            cell: (r) => new Date(r.occurred_at).toLocaleDateString("pt-BR"),
          },
          {
            key: "type",
            header: "Tipo",
            cell: (r) => (
              <span className={r.type === "inflow" ? "text-emerald-600" : "text-red-600"}>
                {r.type === "inflow" ? "Entrada" : "Saída"}
              </span>
            ),
          },
          { key: "counterparty", header: "Origem", cell: (r) => r.counterparty },
          { key: "source", header: "Detalhe", cell: (r) => r.source_label },
          { key: "desc", header: "Descrição", cell: (r) => r.description },
          {
            key: "amount",
            header: "Valor",
            className: "text-right font-medium",
            cell: (r) => (
              <span className={r.type === "inflow" ? "text-emerald-600" : "text-red-600"}>
                {r.type === "inflow" ? "+" : "−"}
                {fmtCurrency(r.amount)}
              </span>
            ),
          },
          {
            key: "balance",
            header: "Saldo",
            className: "text-right text-muted-foreground",
            cell: (r) => fmtCurrency(r.running_balance),
          },
        ]}
        data={rows}
        getRowKey={(r) => r.id}
      />
    </div>
  );
}
