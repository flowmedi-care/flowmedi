"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleDollarSign,
  Receipt,
  TrendingUp,
  Wallet,
  Percent,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { PeriodFilter } from "@/components/dashboard-ui/filters/period-filter";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { ToolbarContextBadge } from "@/components/dashboard-ui/toolbar/toolbar-context-badge";
import {
  CHART_PALETTE,
  MONO_CHART_SCALE,
  MONO_CHART_TREND,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartLineProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import {
  getVendasDashboardMetrics,
} from "./vendas-actions";
import type { VendasDashboardMetrics } from "@/lib/vendas/types";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

type VendasOverviewClientProps = {
  initialMetrics: VendasDashboardMetrics;
};

export function VendasOverviewClient({ initialMetrics }: VendasOverviewClientProps) {
  const [period, setPeriod] = useState<FunnelPeriod>(initialMetrics.period);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handlePeriodChange = (next: FunnelPeriod) => {
    setPeriod(next);
    startTransition(async () => {
      const res = await getVendasDashboardMetrics(next);
      if (res.error) {
        setFetchError(res.error);
        return;
      }
      setFetchError(null);
      if (res.data) setMetrics(res.data);
    });
  };

  const itemMixData = [
    { name: "Serviços", value: metrics.itemMix.servicos },
    { name: "Materiais", value: metrics.itemMix.materiais },
    { name: "Outros", value: metrics.itemMix.outros },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageToolbar>
        <PageToolbar.Filters>
          <PeriodFilter
            mode="range"
            value={period}
            onChange={handlePeriodChange}
            actions={
              <Link href="/dashboard/vendas/relatorio">
                <Button variant="outline" size="sm" className="h-10 shadow-none shrink-0">
                  Relatório detalhado
                </Button>
              </Link>
            }
          />
        </PageToolbar.Filters>
        <PageToolbar.Meta>
          <ToolbarContextBadge>
            {isPending ? "Atualizando métricas…" : "Baseado em comandas emitidas"}
          </ToolbarContextBadge>
        </PageToolbar.Meta>
      </PageToolbar>

      {fetchError && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {fetchError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Receita faturada"
          value={fmt(metrics.receitaFaturada)}
          icon={CircleDollarSign}
          trend={{ value: metrics.trends.receitaFaturada, label: "vs período anterior" }}
        />
        <StatCard
          title="Comandas emitidas"
          value={metrics.comandasEmitidas}
          icon={Receipt}
          trend={{ value: metrics.trends.comandasEmitidas, label: "vs período anterior" }}
        />
        <StatCard
          title="Ticket médio"
          value={fmt(metrics.ticketMedio)}
          icon={TrendingUp}
          trend={{ value: metrics.trends.ticketMedio, label: "vs período anterior" }}
        />
        <StatCard
          title="Taxa de recebimento"
          value={fmtPct(metrics.taxaRecebimento)}
          icon={Percent}
          iconColor="success"
          trend={{ value: metrics.trends.taxaRecebimento, label: "vs período anterior" }}
        />
        <StatCard
          title="Valor em aberto"
          value={fmt(metrics.valorEmAberto)}
          subtitle="Comandas abertas e parciais"
          icon={Wallet}
          iconColor="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Evolução de receita"
          description="Faturamento por comandas no período"
        >
          {metrics.timeSeries.every((b) => b.receita === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={metrics.timeSeries}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" {...chartAxisProps} />
                  <YAxis
                    {...chartAxisProps}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString("pt-BR", { notation: "compact" })
                    }
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value: number, name: string) => [
                      name === "receita" ? fmt(value) : value,
                      name === "receita" ? "Receita" : "Comandas",
                    ]}
                  />
                  <Bar dataKey="receita" fill={MONO_CHART_SCALE[1]} {...chartBarProps} />
                  <Line dataKey="comandas" stroke={MONO_CHART_TREND} {...chartLineProps} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Mix por status" description="Distribuição das comandas">
          {metrics.statusBreakdown.every((s) => s.count === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.statusBreakdown}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {metrics.statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value: number, _name: string, props: { payload?: { total?: number } }) => [
                      `${value} comanda(s) · ${fmt(props.payload?.total ?? 0)}`,
                      "Total",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Top procedimentos/serviços" description="Por valor faturado">
          {metrics.topServicos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem itens no período.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topServicos} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis
                    type="number"
                    {...chartAxisProps}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString("pt-BR", { notation: "compact" })
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    {...chartAxisProps}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value: number) => [fmt(value), "Receita"]}
                  />
                  <Bar dataKey="total" fill={MONO_CHART_SCALE[0]} {...chartBarProps} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Receita por profissional" description="Total faturado">
          {metrics.byProfissional.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.byProfissional} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis
                    type="number"
                    {...chartAxisProps}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString("pt-BR", { notation: "compact" })
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    {...chartAxisProps}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value: number) => [fmt(value), "Receita"]}
                  />
                  <Bar dataKey="total" fill={MONO_CHART_SCALE[2]} {...chartBarProps} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Mix serviço vs material" description="Composição dos itens">
          {itemMixData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem itens no período.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={itemMixData}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="name" {...chartAxisProps} />
                  <YAxis
                    {...chartAxisProps}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString("pt-BR", { notation: "compact" })
                    }
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value: number) => [fmt(value), "Valor"]}
                  />
                  <Bar dataKey="value" fill={MONO_CHART_SCALE[1]} {...chartBarProps} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
