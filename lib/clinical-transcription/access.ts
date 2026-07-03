import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set(["medico", "admin", "secretaria"]);

export async function requireClinicalTranscriptionAccess(appointmentId: string) {
  const { requireClinicMemberWithRole } = await import("@/lib/auth-helpers");
  const { id: userId, clinicId, role } = await requireClinicMemberWithRole();

  if (!ALLOWED_ROLES.has(role)) {
    return {
      ok: false as const,
      status: 403,
      error: "Sem permissão para transcrever áudio.",
    };
  }

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, clinic_id, patient:patients(full_name), doctor:profiles!appointments_doctor_id_fkey(full_name)")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!appointment) {
    return { ok: false as const, status: 404, error: "Consulta não encontrada." };
  }

  const patientRaw = Array.isArray(appointment.patient)
    ? appointment.patient[0]
    : appointment.patient;
  const doctorRaw = Array.isArray(appointment.doctor)
    ? appointment.doctor[0]
    : appointment.doctor;

  return {
    ok: true as const,
    userId,
    clinicId,
    role,
    supabase,
    patientName: String((patientRaw as { full_name?: string })?.full_name ?? "Paciente"),
    doctorName: String((doctorRaw as { full_name?: string })?.full_name ?? "Médico"),
  };
}

export async function requireTranscriptionOwnership(transcriptionId: string, clinicId: string) {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("appointment_transcriptions")
    .select("*")
    .eq("id", transcriptionId)
    .maybeSingle();

  if (error) {
    console.error("[ClinicalTranscription] fetch row error:", error);
    return { ok: false as const, status: 500, error: "Erro ao consultar transcrição." };
  }

  if (!row || row.clinic_id !== clinicId) {
    return { ok: false as const, status: 404, error: "Transcrição não encontrada." };
  }

  return { ok: true as const, row, supabase };
}
