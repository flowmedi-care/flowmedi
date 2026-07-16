"use client";

import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
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
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/dashboard-ui/filters/period-filter";
import { FilterGroup } from "@/components/dashboard-ui/filters/filter-group";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { ToolbarContextBadge } from "@/components/dashboard-ui/toolbar/toolbar-context-badge";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { fmtCurrency, downloadCsv } from "@/lib/financeiro/format";
import { getCashFlowUnified } from "@/lib/financeiro/analytics";
import type { CashFlowBucket, UnifiedLedgerRow } from "@/lib/financeiro/types";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
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
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (next: FunnelPeriod) => {
    setPeriod(next);
    startTransition(async () => {
      const res = await getCashFlowUnified(next);
      if (!res.error) {
        setBuckets(res.buckets);
        setRows(res.rows);
      }
    });
  };

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
          <FilterGroup>
            <PeriodFilter mode="range" value={period} onChange={handlePeriodChange} />
          </FilterGroup>
        </PageToolbar.Filters>
        <PageToolbar.Actions>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shadow-none"
            onClick={exportCsv}
            disabled={isPending}
          >
            Exportar CSV
          </Button>
        </PageToolbar.Actions>
        <PageToolbar.Meta>
          <ToolbarContextBadge>
            {isPending ? "Atualizando…" : "Entradas e saídas do caixa"}
          </ToolbarContextBadge>
        </PageToolbar.Meta>
      </PageToolbar>

      <ChartCard title="Fluxo de caixa" description="Entradas, saídas e líquido por período">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={buckets}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} />
            <Tooltip {...chartTooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
            <Legend />
            <Bar dataKey="inflow" name="Entradas" fill={CHART_PALETTE[0]} {...chartBarProps} />
            <Bar dataKey="outflow" name="Saídas" fill={CHART_PALETTE[3]} {...chartBarProps} />
            <Line dataKey="net" name="Líquido" stroke={CHART_PALETTE[2]} {...chartLineProps} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Saldo acumulado" description="Evolução do caixa no intervalo">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={buckets}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} />
            <Tooltip {...chartTooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
            <Area type="monotone" dataKey="cumulative" name="Acumulado" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.12} />
          </AreaChart>
        </ResponsiveContainer>
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
                {r.type === "inflow" ? "+" : "−"}{fmtCurrency(r.amount)}
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
