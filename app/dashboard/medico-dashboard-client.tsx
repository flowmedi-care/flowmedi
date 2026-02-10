"use client";

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
  metrics,
  nextAppointment,
}: {
  appointments: Appointment[];
  pendingForms: PendingForm[];
  metrics: {
    totalToday: number;
    completed: number;
    remaining: number;
    pendingForms: number;
  };
  nextAppointment: Appointment | null;
}) {
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
  const upcomingAppointments = appointments.filter(
    (a) => new Date(a.scheduled_at) > now && a.status !== "cancelada"
  );
  const pastAppointments = appointments.filter(
    (a) => new Date(a.scheduled_at) <= now || a.status === "realizada"
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard do Médico</h1>
        <p className="text-muted-foreground text-sm">
          Consultas e informações do dia de hoje
        </p>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Total Hoje
              </span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalToday}</div>
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
            <div className="text-2xl font-bold text-green-600">{metrics.completed}</div>
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
            <div className="text-2xl font-bold">{metrics.remaining}</div>
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
              {metrics.pendingForms}
            </div>
          </CardContent>
        </Card>
      </div>

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

        {appointments.length === 0 ? (
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
            {/* Consultas Futuras */}
            {upcomingAppointments.length > 0 && (
              <div className="space-y-2">
                {upcomingAppointments.map((appointment) => {
                  const isNext =
                    nextAppointment?.id === appointment.id;
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

            {/* Consultas Passadas */}
            {pastAppointments.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground">
                  Consultas Realizadas
                </p>
                {pastAppointments.map((appointment) => (
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
    </div>
  );
}
