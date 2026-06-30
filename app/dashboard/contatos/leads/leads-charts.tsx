"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import {
  CHART_PALETTE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import type { LeadsHubMetrics } from "./actions";
import { LIFECYCLE_STAGE_LABELS, LIFECYCLE_STAGES } from "@/lib/leads/lifecycle";
import { Target, Users, RefreshCw, CheckCircle } from "lucide-react";

export function LeadsCharts({ metrics }: { metrics: LeadsHubMetrics }) {
  const lifecycleData = LIFECYCLE_STAGES.map((key) => ({
    name: LIFECYCLE_STAGE_LABELS[key],
    value: metrics.byLifecycle[key],
    key,
  }));

  const totalActive =
    metrics.byLifecycle.lead_novo +
    metrics.byLifecycle.em_qualificacao +
    metrics.byLifecycle.qualificado +
    metrics.byLifecycle.oportunidade +
    metrics.repescagemCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Leads novos"
          value={metrics.byLifecycle.lead_novo}
          subtitle="Aguardando primeiro contato"
          icon={Users}
        />
        <StatCard
          title="Repescagem"
          value={metrics.repescagemCount}
          subtitle="Oportunidades ativas"
          icon={RefreshCw}
          iconColor="warning"
        />
        <StatCard
          title="Oportunidades"
          value={metrics.byLifecycle.oportunidade}
          subtitle="Consultas ou propostas"
          icon={Target}
        />
        <StatCard
          title="Clientes"
          value={metrics.byLifecycle.cliente}
          subtitle={`${totalActive} ativos no funil`}
          icon={CheckCircle}
          iconColor="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Distribuição por etapa do funil" description="Leads no pipeline">
          {lifecycleData.every((s) => s.value === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lifecycleData}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="name" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="value" name="Quantidade" fill={CHART_PALETTE[0]} {...chartBarProps} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Motivos de não conversão" description="Pipeline e repescagem">
          {metrics.byLossReason.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum motivo registrado.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.byLossReason}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ label, count }) => `${label}: ${count}`}
                  >
                    {metrics.byLossReason.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {metrics.weeklyTrend.some((w) => w.captacao > 0 || w.repescagem > 0) && (
        <ChartCard title="Tendência semanal" description="Novos leads vs repescagem">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.weeklyTrend}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="week" {...chartAxisProps} />
                <YAxis {...chartAxisProps} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="captacao" name="Captação" fill={CHART_PALETTE[0]} {...chartBarProps} />
                <Bar dataKey="repescagem" name="Repescagem" fill={CHART_PALETTE[2]} {...chartBarProps} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
