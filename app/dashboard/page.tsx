import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Calendar, FileText, Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, clinic_id")
    .eq("id", user?.id ?? "")
    .single();

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <h1 className="text-xl font-semibold text-foreground">
          Complete seu cadastro
        </h1>
        <p className="text-muted-foreground text-sm">
          Crie sua clínica para começar a usar o FlowMedi. Você será o
          administrador e poderá convidar médicos e secretárias depois.
        </p>
        <p className="text-muted-foreground text-sm">
          E-mail da conta: <strong>{user?.email}</strong>
        </p>
        <p className="text-muted-foreground text-xs max-w-md mx-auto">
          Já tem clínica e mesmo assim vê esta tela? Pode ser permissão no
          banco. No Supabase, execute o script{" "}
          <code className="bg-muted px-1 rounded text-foreground">
            supabase/fix-profiles-ver-membros-clinica.sql
          </code>
          .
        </p>
        <Link
          href="/dashboard/onboarding"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 px-4 py-2 hover:bg-primary/90"
        >
          Criar minha clínica
        </Link>
      </div>
    );
  }

  const name = profile.full_name || user?.email?.split("@")[0] || "Usuário";

  // Buscar configuração de compliance e consultas não confirmadas (apenas para secretárias)
  let complianceAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
  }> = [];
  let complianceDays: number | null = null;

  if (profile.role === "secretaria" && profile.clinic_id) {
    // Buscar configuração de compliance da clínica
    const { data: clinic } = await supabase
      .from("clinics")
      .select("compliance_confirmation_days")
      .eq("id", profile.clinic_id)
      .single();

    complianceDays = clinic?.compliance_confirmation_days ?? null;

    // Se há configuração de compliance, buscar consultas não confirmadas
    if (complianceDays !== null && complianceDays >= 0) {
      const now = new Date();
      const deadlineDate = new Date(now);
      deadlineDate.setDate(deadlineDate.getDate() + complianceDays);
      deadlineDate.setHours(23, 59, 59, 999);

      // Buscar consultas agendadas que estão dentro do prazo de compliance
      const { data: appointments } = await supabase
        .from("appointments")
        .select(
          `
          id,
          scheduled_at,
          patient:patients ( full_name ),
          doctor:profiles ( full_name )
        `
        )
        .eq("clinic_id", profile.clinic_id)
        .eq("status", "agendada")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", deadlineDate.toISOString())
        .order("scheduled_at", { ascending: true });

      if (appointments) {
        complianceAppointments = appointments.map((a: any) => {
          const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
          const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
          return {
            id: String(a.id),
            scheduled_at: String(a.scheduled_at),
            patient: {
              full_name: String(patient?.full_name ?? ""),
            },
            doctor: {
              full_name: doctor?.full_name ?? null,
            },
          };
        });
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {name}
        </h1>
        <p className="text-muted-foreground capitalize">Papel: {profile.role}</p>
      </div>

      {/* Alertas de Compliance para Secretárias */}
      {profile.role === "secretaria" && complianceDays !== null && complianceAppointments.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <span className="font-semibold text-orange-900 dark:text-orange-100">
              Consultas precisando de confirmação
            </span>
            <Badge variant="outline" className="ml-auto bg-orange-100 dark:bg-orange-900/50">
              {complianceAppointments.length}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
              As seguintes consultas devem estar confirmadas até{" "}
              <strong>{complianceDays} dia{complianceDays !== 1 ? "s" : ""}</strong> antes da data agendada:
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
                          {appointment.doctor.full_name && ` • Dr(a). ${appointment.doctor.full_name}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
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
