import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { loadAppointmentGate } from "@/lib/appointment-gate";
import { SchemaErrorBanner } from "../../schema-error-banner";
import { AtendimentoClinicoClient } from "../atendimento-clinico-client";

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

  const gate = await loadAppointmentGate(supabase, id, profile.clinic_id, { includeNotes: false });
  if (!gate.ok && gate.kind === "not_found") notFound();
  if (!gate.ok) {
    return (
      <div className="space-y-4">
        <SchemaErrorBanner message={gate.message} />
      </div>
    );
  }

  const appointment = gate.appointment;
  const appointmentValor = gate.valor;

  const patientRaw = Array.isArray(appointment.patient)
    ? appointment.patient[0]
    : appointment.patient;
  const doctorRaw = Array.isArray(appointment.doctor)
    ? appointment.doctor[0]
    : appointment.doctor;

  const patientId = String((patientRaw as { id?: string })?.id ?? "");
  const patientName = String((patientRaw as { full_name?: string })?.full_name ?? "Paciente");
  const patientBirthDate =
    (patientRaw as { birth_date?: string | null })?.birth_date ?? null;

  let patientPhotoUrl: string | null = null;
  if (patientId) {
    const { data: photoRow } = await supabase
      .from("patients")
      .select("photo_url")
      .eq("id", patientId)
      .maybeSingle();
    patientPhotoUrl = photoRow?.photo_url ?? null;
  }

  const canEdit =
    profile.role === "admin" ||
    profile.role === "secretaria" ||
    profile.role === "medico";
  const isDoctor = profile.role === "medico";

  return (
    <AtendimentoClinicoClient
      appointmentId={id}
      patientId={patientId}
      patientName={patientName}
      patientBirthDate={patientBirthDate}
      patientPhotoUrl={patientPhotoUrl}
      scheduledAt={String(appointment.scheduled_at ?? "")}
      doctorName={(doctorRaw as { full_name?: string })?.full_name ?? null}
      appointmentValor={appointmentValor}
      canEdit={canEdit}
      isDoctor={isDoctor}
      currentUserId={user.id}
      autoFinalize={finalize === "1"}
    />
  );
}
