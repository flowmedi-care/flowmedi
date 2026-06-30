"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  TrendingUp,
  Calendar,
  Users,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { GoalProgressCard } from "@/components/dashboard-ui/goal-progress-card";
import { PageToolbar, PeriodSelect } from "@/components/dashboard-ui/page-toolbar";
import { getStartOfWeek, parseYMD, toYMD } from "@/app/dashboard/agenda/agenda-date-utils";
import { ProcedureWeekPanel } from "./procedure-week-panel";
import { OverviewWeekCalendar } from "./overview-week-calendar";
import { ConsultasTrendChart } from "./consultas-trend-chart";
import {
  getVisaoGeralWeekData,
  type Period,
  type VisaoGeralData,
  type VisaoGeralWeekData,
} from "./actions";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

export function VisaoGeralClient({
  period,
  visaoGeral,
  weekData: initialWeekData,
}: {
  period: Period;
  visaoGeral: VisaoGeralData | null;
  weekData: VisaoGeralWeekData | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const [weekData, setWeekData] = useState(initialWeekData);
  const [weekStart, setWeekStart] = useState(() =>
    initialWeekData?.weekStart
      ? parseYMD(initialWeekData.weekStart)
      : getStartOfWeek(new Date())
  );
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

  const sectionTitleClass = "text-base font-semibold";
  const sectionDescClass = "text-sm text-muted-foreground";

  function setPeriod(nextPeriod: Period) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", nextPeriod);
    router.push(`/dashboard?${p.toString()}`);
  }

  const loadWeek = useCallback((start: Date) => {
    startTransition(async () => {
      const res = await getVisaoGeralWeekData(toYMD(getStartOfWeek(start)));
      if (res.data) {
        setWeekData(res.data);
        setWeekStart(parseYMD(res.data.weekStart));
      }
    });
  }, []);

  function shiftWeek(delta: number) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setSelectedProcedureId(null);
    loadWeek(getStartOfWeek(next));
  }

  if (!visaoGeral) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar os dados da Visão Geral.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageToolbar filters={<PeriodSelect value={period} onChange={setPeriod} options={PERIODS} />} />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de consultas"
            value={visaoGeral.total}
            icon={Calendar}
            trend={{ value: visaoGeral.crescimento, label: "vs período anterior" }}
          />
          <StatCard title="Realizadas" value={visaoGeral.realizadas} icon={TrendingUp} iconColor="success" />
          <StatCard
            title="Canceladas / Faltas"
            value={`${visaoGeral.canceladas} / ${visaoGeral.faltas}`}
            icon={XCircle}
            iconColor="warning"
          />
          <StatCard
            title="Taxa comparecimento"
            value={`${visaoGeral.taxaComparecimento}%`}
            icon={Users}
            iconColor="info"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Perda estimada (faltas/cancelamentos)"
            value={formatCurrency(visaoGeral.receitaPerdidaEstimada)}
            iconColor="destructive"
          />
          <StatCard
            title="Ticket médio (realizadas)"
            value={formatCurrency(visaoGeral.ticketMedioRealizadas)}
          />
          <StatCard
            title="Taxa de no-show"
            value={`${visaoGeral.taxaNoShow}%`}
            icon={AlertCircle}
            iconColor="warning"
          />
        </div>
      </div>

      {weekData && (
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
          <ProcedureWeekPanel
            procedures={weekData.procedures}
            selectedProcedureId={selectedProcedureId}
            onSelectProcedure={setSelectedProcedureId}
          />
          <OverviewWeekCalendar
            weekStart={weekStart}
            appointments={weekData.appointments}
            selectedProcedureId={selectedProcedureId}
            onPrevWeek={() => shiftWeek(-1)}
            onNextWeek={() => shiftWeek(1)}
            loading={isPending}
          />
        </div>
      )}

      {visaoGeral.metas.length > 0 && (
        <GoalProgressCard
          title="Metas operacionais"
          subtitle="Progresso em relação às metas definidas para o período"
          goals={visaoGeral.metas.map((m) => ({
            label: m.label,
            current: m.current,
            target: m.target,
            color:
              m.status === "ok" ? "success" : m.status === "warning" ? "warning" : "primary",
          }))}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <span className={sectionTitleClass}>Top pacientes com risco de no-show</span>
            <p className={sectionDescClass}>
              Priorize contato hoje para reduzir faltas da próxima semana.
            </p>
          </CardHeader>
          <CardContent>
            {visaoGeral.pacientesRiscoNoShow.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem pacientes críticos para os próximos 7 dias.
              </p>
            ) : (
              <div className="space-y-2">
                {visaoGeral.pacientesRiscoNoShow.slice(0, 10).map((p) => (
                  <div
                    key={`${p.patientId}-${p.scheduled_at}`}
                    className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{p.full_name}</p>
                      <p className="text-muted-foreground">
                        {new Date(p.scheduled_at).toLocaleString("pt-BR")}{" "}
                        {p.phone ? `· ${p.phone}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium",
                        p.riskLabel === "alto"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      Risco {p.riskLabel} ({p.riskScore})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <span className={sectionTitleClass}>Horários com maior ociosidade</span>
            <p className={sectionDescClass}>Sugestões de encaixe para aumentar ocupação.</p>
          </CardHeader>
          <CardContent>
            {visaoGeral.horariosOciosos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes no período.</p>
            ) : (
              <div className="space-y-2">
                {visaoGeral.horariosOciosos.map((slot) => (
                  <div key={slot.hour} className="rounded-md border border-border p-3">
                    <p className="font-medium">
                      {slot.hour} - {slot.appointments} agendamentos
                    </p>
                    <p className="text-sm text-muted-foreground">{slot.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {visaoGeral.chartData.length > 0 && <ConsultasTrendChart chartData={visaoGeral.chartData} />}
    </div>
  );
}
