import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "../../consulta/[id]/back-button";
import { AtendimentoClient } from "../../consulta/[id]/atendimento-client";
import { getAppointmentChargePreview } from "../../actions";
import { getStatusBadgeClassName } from "../../status-utils";
import { cn } from "@/lib/utils";
import { ExternalLink, Stethoscope } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

export default async function AtendimentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ finalize?: string }>;
}) {
  const { id } = await params;
  const { finalize } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      valor,
      doctor_id,
      service_id,
      patient:patients ( id, full_name ),
      doctor:profiles!doctor_id ( full_name ),
      services ( nome ),
      appointment_procedures ( procedures ( id, name ) ),
      procedure:procedures ( id, name )
    `
    )
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (error || !appointment) notFound();

  const apProcs = Array.isArray(appointment.appointment_procedures)
    ? appointment.appointment_procedures
    : [];
  const procedures = apProcs.length
    ? apProcs.map((row: Record<string, unknown>) => {
        const pr = Array.isArray(row.procedures) ? row.procedures[0] : row.procedures;
        return { id: String((pr as { id: string }).id), name: String((pr as { name: string }).name) };
      })
    : appointment.procedure
      ? (() => {
          const procRaw = Array.isArray(appointment.procedure)
            ? appointment.procedure[0]
            : appointment.procedure;
          return [{ id: String((procRaw as { id: string }).id), name: String((procRaw as { name: string }).name) }];
        })()
      : [];

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

  const { data: encounter } = await supabase
    .from("encounters")
    .select("status")
    .eq("appointment_id", id)
    .maybeSingle();

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, status, total_amount, paid_amount")
    .eq("appointment_id", id)
    .neq("status", "cancelada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const patient = Array.isArray(appointment.patient)
    ? appointment.patient[0]
    : appointment.patient;
  const doctor = Array.isArray(appointment.doctor)
    ? appointment.doctor[0]
    : appointment.doctor;
  const svc = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const canEdit = profile.role === "admin" || profile.role === "secretaria" || profile.role === "medico";
  const totalPreview = charge?.totalAmount ?? (appointment.valor != null ? Number(appointment.valor) : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton />
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/agenda">Agenda</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/agenda/consulta/${id}`}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Consulta clínica
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold">Atendimento</h1>
            <p className="text-sm text-muted-foreground">
              Consumo de material, comanda e cobrança
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Paciente:</span>{" "}
              <span className="font-medium">{patient?.full_name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Data:</span>{" "}
              {new Date(appointment.scheduled_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {doctor?.full_name && (
              <p>
                <span className="text-muted-foreground">Profissional:</span> {doctor.full_name}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Status consulta:</span>{" "}
              <Badge className={cn(getStatusBadgeClassName(appointment.status))}>
                {STATUS_LABEL[appointment.status] ?? appointment.status}
              </Badge>
            </p>
            {encounter?.status && (
              <p>
                <span className="text-muted-foreground">Atendimento:</span>{" "}
                <Badge variant="outline">{encounter.status}</Badge>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Procedimentos e valor
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {procedures.length === 0 ? (
              <p className="text-muted-foreground">Nenhum procedimento vinculado.</p>
            ) : (
              <ul className="space-y-1">
                {procedures.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            )}
            <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
              {svc?.nome && charge && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço — {svc.nome}</span>
                  <span>{fmt(charge.serviceAmount)}</span>
                </div>
              )}
              {charge?.materialLines.map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {l.product_name} × {l.quantity}
                  </span>
                  <span className="shrink-0">{fmt(l.line_total)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total previsto</span>
                <span>{fmt(totalPreview)}</span>
              </div>
            </div>
            {comanda && (
              <div className="rounded-md border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3">
                <p className="font-medium">Comanda — {comanda.status}</p>
                <p>
                  {fmt(Number(comanda.paid_amount))} / {fmt(Number(comanda.total_amount))}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AtendimentoClient
        appointmentId={id}
        appointmentValor={appointment.valor != null ? Number(appointment.valor) : null}
        canEdit={canEdit}
        autoFinalize={finalize === "1"}
      />
    </div>
  );
}
