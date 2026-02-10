"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import {
  Calendar,
  FileText,
  Users,
  AlertTriangle,
  UserPlus,
  Plus,
  Clock,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PipelineClient } from "./pipeline/pipeline-client";
import { PreferencesClient } from "./preferences/preferences-client";
import type { PipelineItem } from "./pipeline/actions";
import type { DashboardPreferences } from "./preferences/actions";
import { useState } from "react";

export function SecretariaDashboardClient({
  complianceAppointments,
  complianceDays,
  metrics,
  upcomingAppointments,
  pipelineItems,
  preferences,
}: {
  complianceAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
  }>;
  complianceDays: number | null;
  metrics: {
    appointmentsToday: number;
    pipelineCount: number;
    pendingForms: number;
    complianceCount: number;
  } | null;
  upcomingAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
    status: string;
  }>;
  pipelineItems: PipelineItem[];
  preferences: DashboardPreferences;
}) {
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header com Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Dashboard da Secretaria
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie consultas, pacientes e formulários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreferences(!showPreferences)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Preferências
          </Button>
        </div>
      </div>

      {/* Preferências */}
      {showPreferences && (
        <PreferencesClient initialPreferences={preferences} />
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/agenda?action=new">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">Nova Consulta</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Agendar uma nova consulta para um paciente
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/pacientes?action=new">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span className="font-medium">Novo Paciente</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cadastrar um novo paciente na clínica
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/formularios/novo">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">Novo Formulário</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Criar um novo template de formulário
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Métricas */}
      {preferences.show_metrics && metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Consultas Hoje
                </span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.appointmentsToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Compliance
                </span>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.complianceCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Não Cadastrados
                </span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pipelineCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Formulários Pendentes
                </span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pendingForms}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compliance */}
      {preferences.show_compliance &&
        complianceDays !== null &&
        complianceAppointments.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <span className="font-semibold text-orange-900 dark:text-orange-100">
                Consultas precisando de confirmação
              </span>
              <Badge
                variant="outline"
                className="ml-auto bg-orange-100 dark:bg-orange-900/50"
              >
                {complianceAppointments.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
                As seguintes consultas devem estar confirmadas até{" "}
                <strong>
                  {complianceDays} dia{complianceDays !== 1 ? "s" : ""}
                </strong>{" "}
                antes da data agendada:
              </p>
              <div className="space-y-2">
                {complianceAppointments.map((appointment) => {
                  const scheduledDate = new Date(appointment.scheduled_at);
                  const formattedDate = scheduledDate.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                  const formattedTime = scheduledDate.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <Link
                      key={appointment.id}
                      href={`/dashboard/agenda/consulta/${appointment.id}`}
                      className="block p-3 rounded-md bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {appointment.patient.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formattedDate} às {formattedTime}
                            {appointment.doctor.full_name &&
                              ` • Dr(a). ${appointment.doctor.full_name}`}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200"
                        >
                          Não confirmada
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Pipeline de Não Cadastrados */}
      {preferences.show_pipeline && (
        <div>
          <PipelineClient initialItems={pipelineItems} />
        </div>
      )}

      {/* Próximas Consultas */}
      {preferences.show_upcoming_appointments &&
        upcomingAppointments.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Próximas Consultas</span>
                <Link href="/dashboard/agenda">
                  <Button variant="outline" size="sm">
                    Ver todas
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingAppointments.map((appointment) => {
                  const scheduledDate = new Date(appointment.scheduled_at);
                  const formattedDate = scheduledDate.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                  const formattedTime = scheduledDate.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <Link
                      key={appointment.id}
                      href={`/dashboard/agenda/consulta/${appointment.id}`}
                      className="block p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {appointment.patient.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formattedDate} às {formattedTime}
                            {appointment.doctor.full_name &&
                              ` • Dr(a). ${appointment.doctor.full_name}`}
                          </p>
                        </div>
                        <Badge
                          variant={
                            appointment.status === "confirmada"
                              ? "success"
                              : appointment.status === "agendada"
                              ? "warning"
                              : "outline"
                          }
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Links rápidos */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/agenda">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">Agenda</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ver consultas do dia, semana ou mês.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/pacientes">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-medium">Pacientes</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cadastro e histórico de pacientes.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/formularios">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">Formulários</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Formulários clínicos e status de preenchimento.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
