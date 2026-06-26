import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultaTabsClient } from "./consulta-tabs-client";
import { AppointmentStatusBar } from "./appointment-status-bar";
import { DataHoraReagendar } from "./data-hora-reagendar";
import { AppPageHeader } from "@/components/app-page-header";
import { getStatusBadgeClassName } from "../../status-utils";
import { formatPhoneBr } from "@/lib/format-phone";
import { cn } from "@/lib/utils";
import { getAppointmentChargePreview } from "../../actions";
import { AppointmentEncounterNav } from "@/components/appointment-encounter-nav";
import { loadAppointmentProcedures, loadServiceName, type LegacyProcedureRow } from "@/lib/appointment-procedures";
import { loadAppointmentGate } from "@/lib/appointment-gate";
import { SchemaErrorBanner } from "../../schema-error-banner";
import { RecurrenceSeriesButton } from "./recurrence-series-button";
import { POLICY_LABEL } from "./check-in-payment-policy";
import type { PaymentPolicy } from "../../encounter-actions";

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
        <AppPageHeader
          breadcrumbs={[
            { label: "Agenda", href: "/dashboard/agenda" },
            { label: "Consulta" },
          ]}
          backHref="/dashboard/agenda"
        />
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

  let payment_policy: PaymentPolicy | null = null;
  const { data: policyRow } = await supabase
    .from("appointments")
    .select("payment_policy")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();
  if (policyRow?.payment_policy) {
    payment_policy = policyRow.payment_policy as PaymentPolicy;
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

  const doctor = Array.isArray(appointment.doctor)
    ? appointment.doctor[0]
    : appointment.doctor;
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

  const patientName =
    (patient as { full_name?: string } | null | undefined)?.full_name ?? "Consulta";

  return (
    <div className="space-y-6">
      <AppPageHeader
        breadcrumbs={[
          { label: "Agenda", href: "/dashboard/agenda" },
          { label: patientName },
        ]}
        backHref="/dashboard/agenda"
      />
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
            {(serviceName || procedures.length > 0) && (
              <p>
                <span className="text-muted-foreground">Atendimento:</span>{" "}
                {[procedures.map((p) => p.name).join(", ") || null, serviceName]
                  .filter(Boolean)
                  .join(" · ")}
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
            <p>
              <span className="text-muted-foreground">Pagamento:</span>{" "}
              {payment_policy ? (
                <Badge variant="outline">{POLICY_LABEL[payment_policy]}</Badge>
              ) : (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Não definido — edite a consulta
                </span>
              )}
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

      <AppointmentStatusBar
        appointmentId={id}
        appointmentStatus={appointmentStatus}
        startedAt={started_at}
        durationMinutes={duration_minutes}
        canEdit={profile.role === "admin" || profile.role === "secretaria"}
        isDoctor={profile.role === "medico"}
      />

      <ConsultaTabsClient
        appointmentId={id}
        appointmentValor={appointmentValor}
        canEditOperacional={
          profile.role === "admin" ||
          profile.role === "secretaria" ||
          (profile.role === "medico" && doctorId === user.id)
        }
      />
    </div>
  );
}
