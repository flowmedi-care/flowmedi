import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultaTabsClient } from "./consulta-tabs-client";
import { DataHoraReagendar } from "./data-hora-reagendar";
import { BackButton } from "./back-button";
import { getStatusBadgeClassName } from "../../status-utils";
import { formatPhoneBr } from "@/lib/format-phone";
import { cn } from "@/lib/utils";
import { getAppointmentChargePreview } from "../../actions";
import { AppointmentEncounterNav } from "@/components/appointment-encounter-nav";
import { loadAppointmentProcedures, loadServiceName, type LegacyProcedureRow } from "@/lib/appointment-procedures";
import { loadAppointmentGate } from "@/lib/appointment-gate";
import { SchemaErrorBanner } from "../../schema-error-banner";
import { RecurrenceSeriesButton } from "./recurrence-series-button";

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

  const gate = await loadAppointmentGate(supabase, id, profile.clinic_id);
  if (!gate.ok && gate.kind === "not_found") notFound();
  if (!gate.ok) {
    return (
      <div className="space-y-4">
        <BackButton />
        <SchemaErrorBanner message={gate.message} />
      </div>
    );
  }
  const appointment = gate.appointment;
  const service_id = gate.service_id;
  const appointmentValor = gate.valor;
  const scheduledAt = String(appointment.scheduled_at ?? "");
  const appointmentStatus = String(appointment.status ?? "");
  const appointmentNotes =
    appointment.notes != null ? String(appointment.notes) : null;
  const doctorId =
    appointment.doctor_id != null ? String(appointment.doctor_id) : null;

  // Colunas de tempo de atendimento (podem não existir se as migrations não foram rodadas)
  let started_at: string | null = null;
  let completed_at: string | null = null;
  let duration_minutes: number | null = null;
  let scheduled_end_at: string | null = null;
  let planned_duration_minutes: number | null = null;
  const { data: timingRow } = await supabase
    .from("appointments")
    .select(
      "started_at, completed_at, duration_minutes, scheduled_end_at, planned_duration_minutes"
    )
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();
  if (timingRow) {
    started_at = timingRow.started_at ?? null;
    completed_at = timingRow.completed_at ?? null;
    duration_minutes = timingRow.duration_minutes ?? null;
    scheduled_end_at = timingRow.scheduled_end_at ?? null;
    planned_duration_minutes =
      timingRow.planned_duration_minutes != null
        ? Number(timingRow.planned_duration_minutes)
        : null;
  }

  let recurrence_group_id: string | null = null;
  const { data: recurrenceRow } = await supabase
    .from("appointments")
    .select("recurrence_group_id")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();
  if (recurrenceRow?.recurrence_group_id) {
    recurrence_group_id = String(recurrenceRow.recurrence_group_id);
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

  const apProcs = await loadAppointmentProcedures(
    supabase,
    id,
    appointment.procedure as LegacyProcedureRow
  );
  const procedures = apProcs;

  const { data: dimRows } = await supabase
    .from("appointment_dimension_values")
    .select("dimension_value_id")
    .eq("appointment_id", id);
  const dimensionValueIds = (dimRows ?? []).map((r) => r.dimension_value_id as string);

  const chargeRes = await getAppointmentChargePreview(
    procedures.map((p) => p.id),
    doctorId as string,
    service_id,
    dimensionValueIds
  );
  const charge = chargeRes.data;
  const serviceName = await loadServiceName(supabase, service_id);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <BackButton />
      <AppointmentEncounterNav appointmentId={id} activeView="recepcao" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Consulta</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DataHoraReagendar
                scheduledAt={scheduledAt}
                scheduledEndAt={scheduled_end_at}
                appointmentId={id}
                canEdit={profile.role === "admin" || profile.role === "secretaria"}
                isAgendarRetorno={appointmentStatus === "realizada"}
                retornoTypeId={retornoType?.id ?? null}
              />
              {recurrence_group_id && (
                <RecurrenceSeriesButton
                  recurrenceGroupId={recurrence_group_id}
                  appointmentId={id}
                  canManage={
                    profile.role === "admin" || profile.role === "secretaria"
                  }
                />
              )}
            </div>
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
              <Badge className={cn(getStatusBadgeClassName(appointmentStatus))}>
                {appointmentStatus === "agendada"
                  ? "Agendada"
                  : appointmentStatus === "confirmada"
                    ? "Confirmada"
                    : appointmentStatus === "realizada"
                      ? "Realizada"
                      : appointmentStatus === "falta"
                        ? "Falta"
                        : appointmentStatus === "cancelada"
                          ? "Cancelada"
                          : appointmentStatus}
              </Badge>
            </p>
            {(planned_duration_minutes != null || duration_minutes != null) && (
              <p className="text-sm">
                <span className="text-muted-foreground">Duração:</span>{" "}
                {planned_duration_minutes != null && (
                  <span>Previsto {planned_duration_minutes} min</span>
                )}
                {duration_minutes != null && (
                  <span>
                    {planned_duration_minutes != null ? " · " : ""}
                    Real {duration_minutes} min
                    {planned_duration_minutes != null &&
                      duration_minutes > planned_duration_minutes * 1.2 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {" "}
                          (+{duration_minutes - planned_duration_minutes} min)
                        </span>
                      )}
                  </span>
                )}
              </p>
            )}
            {appointmentNotes && (
              <p>
                <span className="text-muted-foreground">Observações:</span>{" "}
                {appointmentNotes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Procedimentos e valor</h2>
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
        appointmentValor={appointmentValor}
        appointmentStatus={appointmentStatus}
        appointmentScheduledAt={scheduledAt}
        startedAt={started_at}
        completedAt={completed_at}
        durationMinutes={duration_minutes}
        doctorId={doctorId}
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
        canEditOperacional={
          profile.role === "admin" ||
          profile.role === "secretaria" ||
          (profile.role === "medico" && doctorId === user.id)
        }
        isDoctor={profile.role === "medico"}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
