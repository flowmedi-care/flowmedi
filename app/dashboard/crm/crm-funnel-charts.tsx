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
import { EngagementFunnelChart } from "@/components/dashboard-ui/engagement-funnel-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHART_PALETTE,
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
import { Target, Calendar, TrendingUp, Users } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
] as const;

type CrmFunnelChartsProps = {
  initialLeadMetrics: LeadFunnelMetrics;
  initialAppointmentMetrics: AppointmentFunnelMetrics;
};

export function CrmFunnelCharts({
  initialLeadMetrics,
  initialAppointmentMetrics,
}: CrmFunnelChartsProps) {
  const [periodDays, setPeriodDays] = useState(30);
  const [leadMetrics, setLeadMetrics] = useState(initialLeadMetrics);
  const [appointmentMetrics, setAppointmentMetrics] = useState(initialAppointmentMetrics);
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (days: number) => {
    setPeriodDays(days);
    const granularity = days <= 30 ? ("day" as const) : ("week" as const);
    startTransition(async () => {
      const [leadRes, apptRes] = await Promise.all([
        getLeadFunnelMetrics(days, granularity),
        getAppointmentFunnelMetrics(days, granularity),
      ]);
      if (leadRes.data) setLeadMetrics(leadRes.data);
      if (apptRes.data) setAppointmentMetrics(apptRes.data);
    });
  };

  const leadCohortSize = leadMetrics.cohortSize;
  const agendadosPct =
    leadMetrics.cumulativeFunnel.find((s) => s.label === "Agendados")?.pct ?? 0;

  const combinedTimeSeries = (() => {
    const map = new Map<
      string,
      {
        label: string;
        novosLeads: number;
        agendadosLeads: number;
        realizadas: number;
        faltas: number;
        taxaComparecimento: number;
      }
    >();

    for (const lead of leadMetrics.timeSeries) {
      map.set(lead.label, {
        label: lead.label,
        novosLeads: lead.novos,
        agendadosLeads: lead.agendados,
        realizadas: 0,
        faltas: 0,
        taxaComparecimento: 0,
      });
    }

    for (const appt of appointmentMetrics.timeSeries) {
      const existing = map.get(appt.label);
      if (existing) {
        existing.realizadas = appt.realizadas;
        existing.faltas = appt.faltas;
        existing.taxaComparecimento = appt.taxaComparecimento;
      } else {
        map.set(appt.label, {
          label: appt.label,
          novosLeads: 0,
          agendadosLeads: 0,
          realizadas: appt.realizadas,
          faltas: appt.faltas,
          taxaComparecimento: appt.taxaComparecimento,
        });
      }
    }

    return Array.from(map.values());
  })();

  return (
    <section id="funis" className={isPending ? "space-y-4 opacity-60" : "space-y-4"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Funis no tempo</h2>
          <p className="text-sm text-muted-foreground">
            Conversão cumulativa de leads e consultas nos últimos {periodDays} dias.
          </p>
        </div>
        <Tabs
          value={String(periodDays)}
          onValueChange={(v) => handlePeriodChange(Number(v))}
        >
          <TabsList>
            {PERIOD_OPTIONS.map((p) => (
              <TabsTrigger key={p.value} value={String(p.value)}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Leads no cohort"
          value={leadCohortSize}
          subtitle={`${agendadosPct}% viraram agendamento`}
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
          description={`Cohort de leads que entraram nos últimos ${periodDays} dias`}
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
          description={`Consultas agendadas no período (${periodDays}d)`}
        >
          {appointmentMetrics.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma consulta no período.
            </p>
          ) : (
            <EngagementFunnelChart
              stages={appointmentMetrics.cumulativeFunnel}
              branches={appointmentMetrics.outcomeBranches}
            />
          )}
        </ChartCard>
      </div>

      {combinedTimeSeries.length > 0 && (
        <ChartCard
          title="Evolução no tempo"
          description="Leads, agendamentos e comparecimento por período"
        >
          <div className="h-[320px] w-full">
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
                <Bar yAxisId="left" dataKey="novosLeads" name="Novos leads" fill={CHART_PALETTE[0]} {...chartBarProps} />
                <Bar yAxisId="left" dataKey="agendadosLeads" name="Leads agendados" fill={CHART_PALETTE[1]} {...chartBarProps} />
                <Bar yAxisId="left" dataKey="realizadas" name="Consultas realizadas" fill={CHART_PALETTE[2]} {...chartBarProps} />
                <Bar yAxisId="left" dataKey="faltas" name="Faltas" fill={CHART_PALETTE[3]} {...chartBarProps} />
                <Line
                  yAxisId="right"
                  dataKey="taxaComparecimento"
                  name="Taxa comparecimento (%)"
                  stroke={CHART_PALETTE[4]}
                  {...chartLineProps}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </section>
  );
}
