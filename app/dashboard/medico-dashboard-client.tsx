"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Clock,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  User,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusBadgeClassName } from "./agenda/status-utils";
import {
  getDoctorMetricsByPeriod,
  getWeeklyAppointments,
  type Period,
} from "./medico-dashboard-actions";
import {
  getDoctorPreferences,
  type DoctorPreferences,
} from "./medico-preferences-actions";

type Appointment = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  patient: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    birth_date: string | null;
  };
  appointment_type: {
    id: string;
    name: string;
  } | null;
};

type PendingForm = {
  appointment_id: string;
  scheduled_at: string;
  patient_name: string;
  status: string;
};

export function MedicoDashboardClient({
  appointments,
  pendingForms,
  metrics: initialMetrics,
  nextAppointment: initialNextAppointment,
  doctorId,
  clinicId,
}: {
  appointments: Appointment[];
  pendingForms: PendingForm[];
  metrics: {
    totalToday: number;
    total: number;
    completed: number;
    remaining: number;
    pendingForms: number;
  };
  nextAppointment: Appointment | null;
  doctorId: string;
  clinicId: string;
}) {
  const [period, setPeriod] = useState<Period>("daily");
  const [metrics, setMetrics] = useState({
    totalToday: initialMetrics.totalToday,
    total: initialMetrics.total,
    completed: initialMetrics.completed,
    remaining: initialMetrics.remaining,
    pendingForms: initialMetrics.pendingForms,
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [weeklyAppointments, setWeeklyAppointments] = useState<
    Array<{
      id: string;
      scheduled_at: string;
      status: string;
      patient: { full_name: string };
      appointment_type: { name: string } | null;
    }>
  >([]);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState(15);

  useEffect(() => {
    if (period !== "daily") {
      loadMetricsByPeriod();
    } else {
      setMetrics({
        totalToday: initialMetrics.totalToday,
        total: initialMetrics.totalToday,
        completed: initialMetrics.completed,
        remaining: initialMetrics.remaining,
        pendingForms: initialMetrics.pendingForms,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    loadWeeklyAppointments();
    loadPreferences();
  }, []);

  async function loadPreferences() {
    const result = await getDoctorPreferences();
    if (result.data) {
      setLateThresholdMinutes(result.data.late_threshold_minutes);
    }
  }

  async function loadMetricsByPeriod() {
    setLoadingMetrics(true);
    const result = await getDoctorMetricsByPeriod(doctorId, clinicId, period);
    if (result.data) {
      setMetrics({
        totalToday: result.data.total,
        total: result.data.total,
        completed: result.data.completed,
        remaining: result.data.remaining,
        pendingForms: result.data.pendingForms,
      });
    }
    setLoadingMetrics(false);
  }

  async function loadWeeklyAppointments() {
    setLoadingWeekly(true);
    const result = await getWeeklyAppointments(doctorId, clinicId);
    if (result.data) {
      setWeeklyAppointments(result.data);
    }
    setLoadingWeekly(false);
  }

  function getPeriodLabel(p: Period): string {
    switch (p) {
      case "daily":
        return "Hoje";
      case "weekly":
        return "Semana";
      case "monthly":
        return "Mês";
      case "yearly":
        return "Ano";
    }
  }

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function calculateAge(birthDate: string | null): number | null {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  const now = new Date();
  
  // Separar consultas por status e atraso
  const allAppointments = appointments.filter(
    (a) => a.status === "agendada" || a.status === "confirmada" || a.status === "realizada" || a.status === "falta" || a.status === "cancelada"
  );

  // Consultas atrasadas: agendadas/confirmadas que passaram do threshold
  const lateAppointments = allAppointments.filter((a) => {
    if (a.status !== "agendada" && a.status !== "confirmada") return false;
    const appointmentTime = new Date(a.scheduled_at);
    const diffMinutes = (now.getTime() - appointmentTime.getTime()) / (1000 * 60);
    return diffMinutes > lateThresholdMinutes;
  });

  // Consultas não atrasadas: agendadas/confirmadas que não passaram do threshold
  const upcomingAppointments = allAppointments.filter((a) => {
    if (a.status !== "agendada" && a.status !== "confirmada") return false;
    const appointmentTime = new Date(a.scheduled_at);
    const diffMinutes = (now.getTime() - appointmentTime.getTime()) / (1000 * 60);
    return diffMinutes <= lateThresholdMinutes;
  });

  // Consultas realizadas, falta ou canceladas vão para baixo
  const pastAppointments = allAppointments.filter(
    (a) => a.status === "realizada" || a.status === "falta" || a.status === "cancelada"
  );

  // Próxima consulta: primeira não atrasada (agendada/confirmada que não está na lista de atrasadas)
  const nextAppointment = upcomingAppointments
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] || null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard do Médico</h1>
        <p className="text-muted-foreground text-sm">
          {period === "daily"
            ? "Consultas e informações do dia de hoje"
            : period === "weekly"
              ? "Consultas e informações da semana atual"
              : period === "monthly"
                ? "Consultas e informações do mês atual"
                : "Consultas e informações do ano atual"}
        </p>
      </div>

      {/* Filtro de Período */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Período:</span>
        {(["daily", "weekly", "monthly", "yearly"] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            disabled={loadingMetrics}
          >
            {getPeriodLabel(p)}
          </Button>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Total {getPeriodLabel(period)}
              </span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : metrics.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Realizadas
              </span>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loadingMetrics ? "..." : metrics.completed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Restantes
              </span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : metrics.remaining}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Formulários Pendentes
              </span>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {loadingMetrics ? "..." : metrics.pendingForms}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultas Atrasadas */}
      {lateAppointments.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="font-semibold text-orange-900 dark:text-orange-100">
                Consultas Atrasadas
              </span>
              <Badge variant="outline" className="ml-auto bg-orange-100 dark:bg-orange-900/50">
                {lateAppointments.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lateAppointments
                .sort((a, b) => 
                  new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                )
                .map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/dashboard/agenda/consulta/${appointment.id}`}
                  >
                    <Card className="hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors cursor-pointer border-orange-200 dark:border-orange-800">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-sm font-semibold min-w-[50px] text-orange-700 dark:text-orange-300">
                              {formatTime(appointment.scheduled_at)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {appointment.patient.full_name}
                              </p>
                              {appointment.appointment_type && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {appointment.appointment_type.name}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 text-xs shrink-0"
                            >
                              Atrasada
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Próxima Consulta em Destaque */}
      {nextAppointment && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">Próxima Consulta</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-lg">{nextAppointment.patient.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(nextAppointment.scheduled_at)}
                  </p>
                  {nextAppointment.appointment_type && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {nextAppointment.appointment_type.name}
                    </p>
                  )}
                </div>
                <Link href={`/dashboard/agenda/consulta/${nextAppointment.id}`}>
                  <Button size="sm">
                    Ver Detalhes
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consultas do Dia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Consultas de Hoje</h2>
          <Link href="/dashboard/agenda">
            <Button variant="outline" size="sm">
              Ver Agenda Completa
            </Button>
          </Link>
        </div>

        {lateAppointments.length === 0 && upcomingAppointments.length === 0 && pastAppointments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma consulta agendada para hoje.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Consultas Agendadas/Confirmadas (não atrasadas) */}
            {upcomingAppointments.length > 0 && (
              <div className="space-y-2">
                {upcomingAppointments
                  .sort((a, b) => 
                    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                  )
                  .map((appointment) => {
                  const isNext = nextAppointment?.id === appointment.id;
                  return (
                    <Link
                      key={appointment.id}
                      href={`/dashboard/agenda/consulta/${appointment.id}`}
                    >
                      <Card
                        className={cn(
                          "hover:bg-muted/50 transition-colors cursor-pointer",
                          isNext && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className={cn(
                                  "text-lg font-semibold min-w-[60px]",
                                  isNext && "text-primary"
                                )}
                              >
                                {formatTime(appointment.scheduled_at)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">{appointment.patient.full_name}</p>
                                  {isNext && (
                                    <Badge variant="secondary" className="text-xs">
                                      Próxima
                                    </Badge>
                                  )}
                                  <Badge
                                    className={cn(
                                      getStatusBadgeClassName(appointment.status)
                                    )}
                                  >
                                    {appointment.status === "agendada"
                                      ? "Agendada"
                                      : appointment.status === "confirmada"
                                      ? "Confirmada"
                                      : appointment.status}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  {appointment.appointment_type && (
                                    <span>{appointment.appointment_type.name}</span>
                                  )}
                                  {appointment.patient.birth_date && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {calculateAge(appointment.patient.birth_date)} anos
                                    </span>
                                  )}
                                  {appointment.patient.phone && (
                                    <span>{appointment.patient.phone}</span>
                                  )}
                                </div>
                                {appointment.notes && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    {appointment.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Consultas Realizadas / Falta / Canceladas (em baixo) */}
            {pastAppointments.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground">
                  Consultas Realizadas / Falta / Canceladas
                </p>
                {pastAppointments
                  .sort((a, b) => 
                    new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
                  )
                  .map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/dashboard/agenda/consulta/${appointment.id}`}
                  >
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer opacity-75">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-lg font-semibold min-w-[60px] text-muted-foreground">
                              {formatTime(appointment.scheduled_at)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">{appointment.patient.full_name}</p>
                                <Badge
                                  className={cn(
                                    getStatusBadgeClassName(appointment.status)
                                  )}
                                >
                                  {appointment.status === "realizada"
                                    ? "Realizada"
                                    : appointment.status === "falta"
                                    ? "Falta"
                                    : appointment.status}
                                </Badge>
                              </div>
                              {appointment.appointment_type && (
                                <p className="text-xs text-muted-foreground">
                                  {appointment.appointment_type.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alertas - Formulários Pendentes */}
      {pendingForms.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <span className="font-semibold text-orange-900 dark:text-orange-100">
              Formulários Pendentes
            </span>
            <Badge
              variant="outline"
              className="ml-auto bg-orange-100 dark:bg-orange-900/50"
            >
              {pendingForms.length}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
              Os seguintes pacientes ainda não preencheram os formulários:
            </p>
            <div className="space-y-2">
              {pendingForms.map((form) => (
                <Link
                  key={form.appointment_id}
                  href={`/dashboard/agenda/consulta/${form.appointment_id}`}
                  className="block p-3 rounded-md bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {form.patient_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(form.scheduled_at)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200"
                    >
                      {form.status === "pendente" ? "Pendente" : "Incompleto"}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendário Semanal */}
      <WeeklyCalendar appointments={weeklyAppointments} loading={loadingWeekly} />
    </div>
  );
}

function WeeklyCalendar({
  appointments,
  loading,
}: {
  appointments: Array<{
    id: string;
    scheduled_at: string;
    status: string;
    patient: { full_name: string };
    appointment_type: { name: string } | null;
  }>;
  loading: boolean;
}) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  function getDayName(date: Date): string {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  function getAppointmentsForDay(day: Date) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return appointments.filter((apt) => {
      const aptDate = new Date(apt.scheduled_at);
      return aptDate >= dayStart && aptDate <= dayEnd;
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Calendário Semanal</h2>
        <p className="text-sm text-muted-foreground">
          {formatDate(days[0])} - {formatDate(days[6])}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando calendário...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={index}
                  className={cn(
                    "border rounded-lg p-2 min-h-[120px]",
                    isTodayDate && "border-primary bg-primary/5"
                  )}
                >
                  <div className="mb-2">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        isTodayDate && "text-primary font-semibold"
                      )}
                    >
                      {getDayName(day)}
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        isTodayDate && "text-primary"
                      )}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem consultas</p>
                    ) : (
                      dayAppointments.map((apt) => (
                        <Link
                          key={apt.id}
                          href={`/dashboard/agenda/consulta/${apt.id}`}
                          className="block p-1.5 rounded text-xs bg-muted hover:bg-muted/80 transition-colors"
                        >
                          <p className="font-medium truncate">{apt.patient.full_name}</p>
                          <p className="text-muted-foreground">{formatTime(apt.scheduled_at)}</p>
                          <Badge
                            className={cn(
                              "text-xs mt-1",
                              getStatusBadgeClassName(apt.status)
                            )}
                          >
                            {apt.status === "realizada"
                              ? "Realizada"
                              : apt.status === "agendada"
                                ? "Agendada"
                                : apt.status === "confirmada"
                                  ? "Confirmada"
                                  : apt.status}
                          </Badge>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
