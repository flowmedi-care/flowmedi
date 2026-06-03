import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultaTabsClient } from "./consulta-tabs-client";
import { DataHoraReagendar } from "./data-hora-reagendar";
import { BackButton } from "./back-button";
import { getStatusBadgeClassName } from "../../status-utils";
import { formatPhoneBr } from "@/lib/format-phone";
import { cn } from "@/lib/utils";
import { getAppointmentChargePreview } from "../../actions";
import { Package } from "lucide-react";
import { loadAppointmentProcedures, loadServiceName } from "@/lib/appointment-procedures";

export type FormInstanceItem = {
  id: string;
  status: string;
  link_token: string | null;
  slug: string | null;
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

  // Colunas base — sem joins que dependem de migration-procedure-hub-operations
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      valor,
      doctor_id,
      service_id,
      patient:patients ( id, full_name, email, phone, birth_date, cpf ),
      doctor:profiles!doctor_id ( id, full_name ),
      appointment_type:appointment_types ( id, name ),
      procedure:procedures ( id, name )
    `
    )
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (appointmentError || !appointment) notFound();

  // Colunas de tempo de atendimento (podem não existir se as migrations não foram rodadas)
  let started_at: string | null = null;
  let completed_at: string | null = null;
  let duration_minutes: number | null = null;
  const { data: timingRow } = await supabase
    .from("appointments")
    .select("started_at, completed_at, duration_minutes")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();
  if (timingRow) {
    started_at = timingRow.started_at ?? null;
    completed_at = timingRow.completed_at ?? null;
    duration_minutes = timingRow.duration_minutes ?? null;
  }

  const { data: appointmentTypes } = await supabase
    .from("appointment_types")
    .select("id, slug")
    .eq("clinic_id", profile.clinic_id);
  const retornoType = (appointmentTypes ?? []).find((t: { slug?: string }) => t.slug === "retorno");

  const patient = Array.isArray(appointment.patient)
    ? appointment.patient[0]
    : appointment.patient;
  const patientEmail = (patient as { email?: string } | null)?.email;

  // Vincular formulários públicos já preenchidos pelo paciente (para consultas antigas sem vínculo)
  if (patientEmail) {
    const { data: publicInstances } = await supabase
      .from("form_instances")
      .select("id, form_templates!inner(clinic_id)")
      .is("appointment_id", null)
      .eq("status", "respondido")
      .ilike("public_submitter_email", patientEmail.trim())
      .eq("form_templates.clinic_id", profile.clinic_id);
    const ids = (publicInstances ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await supabase.from("form_instances").update({ appointment_id: id }).in("id", ids);
    }
  }

  const { data: instances } = await supabase
    .from("form_instances")
    .select(`
      id,
      status,
      link_token,
      slug,
      responses,
      form_template:form_templates ( name, definition )
    `)
    .eq("appointment_id", id);

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
      slug: fi.slug != null ? String(fi.slug) : null,
      responses: (fi.responses as Record<string, unknown>) ?? {},
      template_name: ftObj?.name ?? "",
      definition: (Array.isArray(ftObj?.definition) ? ftObj.definition : []) as FormInstanceItem["definition"],
    };
  });

  const apProcs = await loadAppointmentProcedures(supabase, id, appointment.procedure);
  const procedures = apProcs;

  const { data: dimRows } = await supabase
    .from("appointment_dimension_values")
    .select("dimension_value_id")
    .eq("appointment_id", id);
  const dimensionValueIds = (dimRows ?? []).map((r) => r.dimension_value_id as string);

  const chargeRes = await getAppointmentChargePreview(
    procedures.map((p) => p.id),
    appointment.doctor_id as string,
    appointment.service_id as string | null,
    dimensionValueIds
  );
  const charge = chargeRes.data;
  const serviceName = await loadServiceName(supabase, appointment.service_id as string | null);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <BackButton />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Consulta</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <DataHoraReagendar
              scheduledAt={appointment.scheduled_at}
              appointmentId={id}
              canEdit={profile.role === "admin" || profile.role === "secretaria"}
              isAgendarRetorno={appointment.status === "realizada"}
              retornoTypeId={retornoType?.id ?? null}
            />
            <p>
              <span className="text-muted-foreground">Paciente:</span>{" "}
              {patient?.full_name}
            </p>
            <p>
              <span className="text-muted-foreground">Profissional:</span>{" "}
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
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-semibold">Procedimentos e valor</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/agenda/atendimento/${id}`}>
                <Package className="h-4 w-4 mr-1" />
                Atendimento
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {procedures.length === 0 ? (
              <p className="text-muted-foreground">Nenhum procedimento.</p>
            ) : (
              <ul className="space-y-1">
                {procedures.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            )}
            {charge && (
              <div className="rounded-lg border p-3 space-y-1 bg-muted/30 mt-2">
                {serviceName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço — {serviceName}</span>
                    <span>{fmt(charge.serviceAmount)}</span>
                  </div>
                )}
                {charge.materialLines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">
                      {l.product_name} × {l.quantity}
                    </span>
                    <span>{fmt(l.line_total)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{fmt(charge.totalAmount)}</span>
                </div>
              </div>
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
              <p className="text-sm text-muted-foreground">{formatPhoneBr(patient.phone)}</p>
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
        appointmentValor={appointment.valor != null ? Number(appointment.valor) : null}
        appointmentStatus={appointment.status}
        appointmentScheduledAt={appointment.scheduled_at}
        startedAt={started_at}
        completedAt={completed_at}
        durationMinutes={duration_minutes}
        doctorId={appointment.doctor_id ?? null}
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
        isDoctor={profile.role === "medico"}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
