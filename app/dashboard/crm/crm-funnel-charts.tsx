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
import {
  StackedFunnelChart,
  FUNNEL_CLASSIC_COLORS,
} from "@/components/dashboard-ui/stacked-funnel-chart";
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
import { PIPELINE_STAGE_LABELS } from "@/components/dashboard-ui/kanban/pipeline-stage-colors";
import { APPOINTMENT_PIPELINE_STAGE_LABELS } from "@/components/dashboard-ui/kanban/appointment-pipeline-stage-colors";
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

  const leadFunnelStages = [
    {
      label: PIPELINE_STAGE_LABELS.novo_contato,
      value: leadMetrics.snapshot.novo_contato,
      color: FUNNEL_CLASSIC_COLORS[0],
    },
    {
      label: PIPELINE_STAGE_LABELS.aguardando_retorno,
      value: leadMetrics.snapshot.aguardando_retorno,
      color: FUNNEL_CLASSIC_COLORS[1],
    },
    {
      label: PIPELINE_STAGE_LABELS.cadastrado,
      value: leadMetrics.snapshot.cadastrado,
      color: FUNNEL_CLASSIC_COLORS[2],
    },
    {
      label: PIPELINE_STAGE_LABELS.agendado,
      value: leadMetrics.snapshot.agendado,
      color: FUNNEL_CLASSIC_COLORS[5],
    },
  ];

  const appointmentTotal =
    appointmentMetrics.snapshot.agendadas +
    appointmentMetrics.snapshot.confirmadas +
    appointmentMetrics.snapshot.realizadas +
    appointmentMetrics.snapshot.faltas +
    appointmentMetrics.snapshot.canceladas;

  const appointmentFunnelStages = [
    {
      label: APPOINTMENT_PIPELINE_STAGE_LABELS.agendada,
      value: appointmentTotal,
      color: FUNNEL_CLASSIC_COLORS[0],
    },
    {
      label: APPOINTMENT_PIPELINE_STAGE_LABELS.confirmada,
      value:
        appointmentMetrics.snapshot.confirmadas +
        appointmentMetrics.snapshot.realizadas +
        appointmentMetrics.snapshot.faltas,
      color: FUNNEL_CLASSIC_COLORS[1],
    },
    {
      label: APPOINTMENT_PIPELINE_STAGE_LABELS.realizada,
      value: appointmentMetrics.snapshot.realizadas,
      color: FUNNEL_CLASSIC_COLORS[2],
    },
    {
      label: APPOINTMENT_PIPELINE_STAGE_LABELS.falta,
      value: appointmentMetrics.snapshot.faltas,
      color: FUNNEL_CLASSIC_COLORS[3],
    },
    {
      label: APPOINTMENT_PIPELINE_STAGE_LABELS.cancelada,
      value: appointmentMetrics.snapshot.canceladas,
      color: FUNNEL_CLASSIC_COLORS[4],
    },
  ];

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
            Captação de leads e comparecimento de consultas nos últimos {periodDays} dias.
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
          title="Leads no pipeline"
          value={leadMetrics.total}
          subtitle={`${leadMetrics.taxaAgendamento}% viraram agendamento`}
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
          description="Distribuição atual dos leads por etapa"
        >
          {leadMetrics.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum lead no pipeline.
            </p>
          ) : (
            <StackedFunnelChart stages={leadFunnelStages} />
          )}
        </ChartCard>

        <ChartCard
          title="Funil de comparecimento"
          description={`Consultas agendadas no período (${periodDays}d)`}
        >
          {appointmentTotal === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma consulta no período.
            </p>
          ) : (
            <StackedFunnelChart stages={appointmentFunnelStages} />
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
