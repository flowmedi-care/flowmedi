import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultaTabsClient } from "./consulta-tabs-client";
import { DataHoraReagendar } from "./data-hora-reagendar";
import { ArrowLeft } from "lucide-react";
import { getStatusBadgeClassName } from "../../status-utils";
import { cn } from "@/lib/utils";

export type FormInstanceItem = {
  id: string;
  status: string;
  link_token: string | null;
  responses: Record<string, unknown>;
  template_name: string;
  definition: (import("@/lib/form-types").FormFieldDefinition & { id: string })[];
};

export default async function ConsultaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      patient:patients ( id, full_name, email, phone, birth_date ),
      doctor:profiles ( id, full_name ),
      appointment_type:appointment_types ( id, name )
    `
    )
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!appointment) notFound();

  const { data: instances } = await supabase
    .from("form_instances")
    .select(`
      id,
      status,
      link_token,
      responses,
      form_template:form_templates ( name, definition )
    `)
    .eq("appointment_id", id);

  const patient = Array.isArray(appointment.patient)
    ? appointment.patient[0]
    : appointment.patient;
  const doctor = Array.isArray(appointment.doctor)
    ? appointment.doctor[0]
    : appointment.doctor;
  const appointmentType = Array.isArray(appointment.appointment_type)
    ? appointment.appointment_type[0]
    : appointment.appointment_type;

  const formInstances: FormInstanceItem[] = (instances ?? []).map((fi: Record<string, unknown>) => {
    const ft = Array.isArray(fi.form_template) ? fi.form_template[0] : fi.form_template;
    const ftObj = ft as { name?: string; definition?: unknown } | null;
    return {
      id: String(fi.id ?? ""),
      status: String(fi.status ?? ""),
      link_token: fi.link_token != null ? String(fi.link_token) : null,
      responses: (fi.responses as Record<string, unknown>) ?? {},
      template_name: ftObj?.name ?? "",
      definition: (Array.isArray(ftObj?.definition) ? ftObj.definition : []) as FormInstanceItem["definition"],
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/dashboard/agenda">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar à agenda
        </Button>
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Consulta</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <DataHoraReagendar
              scheduledAt={appointment.scheduled_at}
              appointmentId={id}
              canEdit={profile.role === "admin" || profile.role === "secretaria"}
            />
            <p>
              <span className="text-muted-foreground">Paciente:</span>{" "}
              {patient?.full_name}
            </p>
            <p>
              <span className="text-muted-foreground">Médico:</span>{" "}
              {doctor?.full_name ?? "—"}
            </p>
            {appointmentType && (
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                {appointmentType.name}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              <Badge className={cn(getStatusBadgeClassName(appointment.status))}>
                {appointment.status === "agendada"
                  ? "Agendada"
                  : appointment.status === "confirmada"
                    ? "Confirmada"
                    : appointment.status === "realizada"
                      ? "Realizada"
                      : appointment.status === "falta"
                        ? "Falta"
                        : appointment.status === "cancelada"
                          ? "Cancelada"
                          : appointment.status}
              </Badge>
            </p>
            {appointment.notes && (
              <p>
                <span className="text-muted-foreground">Observações:</span>{" "}
                {appointment.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Paciente</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{patient?.full_name}</p>
            {patient?.email && (
              <p className="text-sm text-muted-foreground">{patient.email}</p>
            )}
            {patient?.phone && (
              <p className="text-sm text-muted-foreground">{patient.phone}</p>
            )}
            {patient?.birth_date && (
              <p className="text-sm text-muted-foreground">
                Nasc.:{" "}
                {new Date(patient.birth_date).toLocaleDateString("pt-BR")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConsultaTabsClient
        appointmentId={id}
        appointmentStatus={appointment.status}
        appointmentScheduledAt={appointment.scheduled_at}
        patientId={patient?.id ?? ""}
        patientData={{
          full_name: patient?.full_name ?? "",
          email: patient?.email ?? null,
          phone: patient?.phone ?? null,
          birth_date: patient?.birth_date ?? null,
        }}
        formInstances={formInstances}
        baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        canEdit={profile.role === "admin" || profile.role === "secretaria"}
      />
    </div>
  );
}
