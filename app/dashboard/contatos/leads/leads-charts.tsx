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
import { LEAD_SEGMENT_LABELS, type LeadHubSegment } from "@/lib/leads/segments";
import { Target, Users, RefreshCw, CheckCircle } from "lucide-react";

export function LeadsCharts({ metrics }: { metrics: LeadsHubMetrics }) {
  const segmentData = (
    Object.entries(metrics.bySegment) as [LeadHubSegment, number][]
  ).map(([key, value]) => ({
    name: LEAD_SEGMENT_LABELS[key],
    value,
    key,
  }));

  const totalActive =
    metrics.bySegment.captacao +
    metrics.bySegment.nao_fechou +
    metrics.bySegment.pendente_retorno +
    metrics.bySegment.repescagem;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Captação"
          value={metrics.bySegment.captacao}
          subtitle="Novos contatos"
          icon={Users}
        />
        <StatCard
          title="Repescagem"
          value={metrics.bySegment.repescagem}
          subtitle="Oportunidades ativas"
          icon={RefreshCw}
          iconColor="warning"
        />
        <StatCard
          title="Não fechou"
          value={metrics.bySegment.nao_fechou}
          subtitle="Aguardando decisão"
          icon={Target}
        />
        <StatCard
          title="Concluídos"
          value={metrics.bySegment.concluido}
          subtitle={`${totalActive} ativos no funil`}
          icon={CheckCircle}
          iconColor="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Distribuição por segmento" description="Leads e repescagem ativos">
          {segmentData.every((s) => s.value === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentData}>
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
