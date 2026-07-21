"use client";

import { useState, useTransition } from "react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { PeriodFilter } from "@/components/dashboard-ui/filters/period-filter";
import { EngagementFunnelChart } from "@/components/dashboard-ui/engagement-funnel-chart";
import {
  MONO_CHART_SCALE,
  MONO_CHART_TREND,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
  chartLineProps,
} from "@/components/dashboard-ui/chart-theme";
import {
  getLeadFunnelMetrics,
  getAppointmentFunnelMetrics,
  type LeadFunnelMetrics,
  type AppointmentFunnelMetrics,
} from "./pipeline-actions";
import {
  type FunnelPeriod,
  formatPeriodRangeLabel,
} from "@/lib/analytics/time-buckets";
import { Target, Calendar, TrendingUp, Users, Info } from "lucide-react";

type CrmFunnelChartsProps = {
  initialLeadMetrics: LeadFunnelMetrics;
  initialAppointmentMetrics: AppointmentFunnelMetrics;
};

export function CrmFunnelCharts({
  initialLeadMetrics,
  initialAppointmentMetrics,
}: CrmFunnelChartsProps) {
  const [period, setPeriod] = useState<FunnelPeriod>(initialLeadMetrics.period);
  const [leadMetrics, setLeadMetrics] = useState(initialLeadMetrics);
  const [appointmentMetrics, setAppointmentMetrics] = useState(initialAppointmentMetrics);
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handlePeriodChange = (next: FunnelPeriod) => {
    setPeriod(next);
    startTransition(async () => {
      const [leadRes, apptRes] = await Promise.all([
        getLeadFunnelMetrics(next),
        getAppointmentFunnelMetrics(next),
      ]);
      if (leadRes.error || apptRes.error) {
        setFetchError(leadRes.error || apptRes.error);
        return;
      }
      setFetchError(null);
      if (leadRes.data) setLeadMetrics(leadRes.data);
      if (apptRes.data) setAppointmentMetrics(apptRes.data);
    });
  };

  const leadCohortSize = leadMetrics.cohortSize;
  const agendadosPct =
    leadMetrics.cumulativeFunnel.find((s) => s.label === "Oportunidade+")?.pct ?? 0;
  const periodLabel = formatPeriodRangeLabel(period);

  const leadToConsultConversion =
    leadCohortSize > 0
      ? Math.round((appointmentMetrics.total / leadCohortSize) * 100)
      : 0;
  const consultToRealizada =
    appointmentMetrics.total > 0
      ? Math.round(
          (appointmentMetrics.snapshot.realizadas / appointmentMetrics.total) * 100
        )
      : 0;

  /** Tendência gerencial: só contagens (sem % diária instável). */
  const trendSeries = (() => {
    const map = new Map<
      string,
      { label: string; novosLeads: number; consultasAgendadas: number; realizadas: number }
    >();
    for (const lead of leadMetrics.timeSeries) {
      map.set(lead.dateKey, {
        label: lead.label,
        novosLeads: lead.novos,
        consultasAgendadas: 0,
        realizadas: 0,
      });
    }
    for (const appt of appointmentMetrics.timeSeries) {
      const existing = map.get(appt.dateKey);
      if (existing) {
        existing.consultasAgendadas = appt.agendadas;
        existing.realizadas = appt.realizadas;
      } else {
        map.set(appt.dateKey, {
          label: appt.label,
          novosLeads: 0,
          consultasAgendadas: appt.agendadas,
          realizadas: appt.realizadas,
        });
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  })();

  return (
    <section id="funis" className={isPending ? "space-y-4 opacity-60" : "space-y-4"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Desempenho do período</h2>
          <p className="text-sm text-muted-foreground">
            Visão gerencial · {periodLabel}. Operação de Cases na Jornada.
          </p>
        </div>
        <PeriodFilter mode="range" value={period} onChange={handlePeriodChange} className="lg:max-w-xl" />
      </div>

      {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Novos leads"
          value={leadCohortSize}
          subtitle={`${agendadosPct}% com agendamento`}
          icon={Users}
        />
        <StatCard
          title="Consultas agendadas"
          value={appointmentMetrics.total}
          subtitle={`${appointmentMetrics.taxaConfirmacao}% confirmadas`}
          icon={Calendar}
        />
        <StatCard
          title="Lead → Consulta"
          value={`${leadToConsultConversion}%`}
          subtitle="Conversão no período"
          icon={TrendingUp}
          iconColor="success"
        />
        <StatCard
          title="Consulta → Realizada"
          value={`${consultToRealizada}%`}
          subtitle={`${appointmentMetrics.snapshot.realizadas} realizadas`}
          icon={Target}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funil de captação"
          description={
            <span className="inline-flex items-center gap-1.5">
              Leads que entraram no período
              <span
                className="inline-flex text-muted-foreground"
                title="Conta leads cuja entrada no funil ocorreu neste intervalo."
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </span>
          }
        >
          {leadCohortSize === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum lead entrou no período.
            </p>
          ) : (
            <EngagementFunnelChart stages={leadMetrics.cumulativeFunnel} />
          )}
        </ChartCard>

        <ChartCard title="Funil de comparecimento" description="Agregado do período (não é posto operacional)">
          {appointmentMetrics.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma consulta no período.
            </p>
          ) : (
            <EngagementFunnelChart
              stages={appointmentMetrics.cumulativeFunnel}
              branches={appointmentMetrics.outcomeBranches}
              variant="mono"
            />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Tendência"
        description="Novos leads, consultas agendadas e realizadas — contagens (sem taxa diária)"
      >
        {trendSeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum dado no período.
          </p>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendSeries}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis {...chartAxisProps} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Bar
                  dataKey="novosLeads"
                  name="Novos leads"
                  fill={MONO_CHART_SCALE[0]}
                  {...chartBarProps}
                />
                <Bar
                  dataKey="consultasAgendadas"
                  name="Consultas agendadas"
                  fill={MONO_CHART_SCALE[2]}
                  {...chartBarProps}
                />
                <Line
                  dataKey="realizadas"
                  name="Realizadas"
                  stroke={MONO_CHART_TREND}
                  {...chartLineProps}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </section>
  );
}
