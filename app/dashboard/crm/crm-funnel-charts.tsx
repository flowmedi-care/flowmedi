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
import { PeriodRangePicker } from "@/components/dashboard-ui/period-range-picker";
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
    leadMetrics.cumulativeFunnel.find((s) => s.label === "Agendados")?.pct ?? 0;
  const periodLabel = formatPeriodRangeLabel(period);

  const combinedTimeSeries = (() => {
    const map = new Map<
      string,
      {
        dateKey: string;
        label: string;
        novosLeads: number;
        agendadosLeads: number;
        consultasAgendadas: number;
        consultasConfirmadas: number;
        realizadas: number;
        faltas: number;
        canceladas: number;
        taxaComparecimento: number;
      }
    >();

    for (const lead of leadMetrics.timeSeries) {
      map.set(lead.dateKey, {
        dateKey: lead.dateKey,
        label: lead.label,
        novosLeads: lead.novos,
        agendadosLeads: lead.agendados,
        consultasAgendadas: 0,
        consultasConfirmadas: 0,
        realizadas: 0,
        faltas: 0,
        canceladas: 0,
        taxaComparecimento: 0,
      });
    }

    for (const appt of appointmentMetrics.timeSeries) {
      const existing = map.get(appt.dateKey);
      if (existing) {
        existing.consultasAgendadas = appt.agendadas;
        existing.consultasConfirmadas = appt.confirmadas;
        existing.realizadas = appt.realizadas;
        existing.faltas = appt.faltas;
        existing.canceladas = appt.canceladas;
        existing.taxaComparecimento = appt.taxaComparecimento;
      } else {
        map.set(appt.dateKey, {
          dateKey: appt.dateKey,
          label: appt.label,
          novosLeads: 0,
          agendadosLeads: 0,
          consultasAgendadas: appt.agendadas,
          consultasConfirmadas: appt.confirmadas,
          realizadas: appt.realizadas,
          faltas: appt.faltas,
          canceladas: appt.canceladas,
          taxaComparecimento: appt.taxaComparecimento,
        });
      }
    }

    const keys = [
      ...new Set([
        ...leadMetrics.timeSeries.map((b) => b.dateKey),
        ...appointmentMetrics.timeSeries.map((b) => b.dateKey),
      ]),
    ].sort();

    return keys.map((key) => map.get(key)!);
  })();

  return (
    <section id="funis" className={isPending ? "space-y-4 opacity-60" : "space-y-4"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Funis no tempo</h2>
          <p className="text-sm text-muted-foreground">
            Conversão cumulativa de leads e consultas · {periodLabel}
          </p>
        </div>
        <PeriodRangePicker period={period} onChange={handlePeriodChange} className="lg:max-w-xl" />
      </div>

      {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Novos leads no período"
          value={leadCohortSize}
          subtitle={`${agendadosPct}% viraram agendamento · Leads que entraram no funil`}
          icon={Users}
        />
        <StatCard
          title="Consultas no período"
          value={appointmentMetrics.total}
          subtitle={`${appointmentMetrics.taxaConfirmacao}% confirmadas`}
          icon={Calendar}
        />
        <StatCard
          title="Comparecimento"
          value={`${appointmentMetrics.taxaComparecimento}%`}
          subtitle={`${appointmentMetrics.snapshot.realizadas} realizadas`}
          icon={TrendingUp}
          iconColor="success"
        />
        <StatCard
          title="No-show"
          value={`${appointmentMetrics.taxaNoShow}%`}
          subtitle={`${appointmentMetrics.snapshot.faltas} faltas`}
          icon={Target}
          iconColor="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funil de captação"
          description={
            <span className="inline-flex items-center gap-1.5">
              Leads que entraram no período selecionado
              <span
                className="inline-flex text-muted-foreground"
                title="Conta leads cuja entrada no funil (criação ou primeiro histórico) ocorreu neste intervalo — não o total de leads ativos."
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

        <ChartCard
          title="Funil de comparecimento"
          description={`Consultas agendadas no período`}
        >
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
        title="Evolução no tempo"
        description="Leads, agendamentos e comparecimento por período"
      >
        {combinedTimeSeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum dado no período selecionado.
          </p>
        ) : (
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedTimeSeries}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  {...chartAxisProps}
                />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="novosLeads"
                  name="Novos leads"
                  fill={MONO_CHART_SCALE[0]}
                  {...chartBarProps}
                />
                <Bar
                  yAxisId="left"
                  dataKey="agendadosLeads"
                  name="Leads agendados"
                  fill={MONO_CHART_SCALE[1]}
                  {...chartBarProps}
                />
                <Bar
                  yAxisId="left"
                  dataKey="consultasAgendadas"
                  name="Consultas agendadas"
                  fill={MONO_CHART_SCALE[2]}
                  {...chartBarProps}
                />
                <Bar
                  yAxisId="left"
                  dataKey="consultasConfirmadas"
                  name="Consultas confirmadas"
                  fill={MONO_CHART_SCALE[3]}
                  {...chartBarProps}
                />
                <Bar
                  yAxisId="left"
                  dataKey="realizadas"
                  name="Realizadas"
                  fill={MONO_CHART_SCALE[0]}
                  fillOpacity={0.7}
                  {...chartBarProps}
                />
                <Bar
                  yAxisId="left"
                  dataKey="faltas"
                  name="Faltas"
                  fill={MONO_CHART_SCALE[1]}
                  fillOpacity={0.5}
                  {...chartBarProps}
                />
                <Bar
                  yAxisId="left"
                  dataKey="canceladas"
                  name="Canceladas"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.35}
                  {...chartBarProps}
                />
                <Line
                  yAxisId="right"
                  dataKey="taxaComparecimento"
                  name="Taxa comparecimento (%)"
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
