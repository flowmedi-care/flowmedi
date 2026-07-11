import type { SupabaseClient } from "@supabase/supabase-js";
import { listPatientAppointmentsViaAssistant } from "@/lib/virtual-assistant/services/appointments";

export type AppointmentSlice = {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_name: string | null;
  procedure_name: string | null;
  valor: number | null;
};

export async function loadAppointmentsSlice(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string | null | undefined,
  opts?: { upcomingOnly?: boolean }
): Promise<AppointmentSlice[]> {
  if (!patientId) return [];
  const rows = await listPatientAppointmentsViaAssistant(supabase, clinicId, patientId, {
    upcomingOnly: opts?.upcomingOnly ?? true,
  });
  return rows.map((r) => ({
    id: r.id,
    scheduled_at: r.scheduled_at,
    status: r.status,
    doctor_name: r.doctor_name,
    procedure_name: r.procedure_name,
    valor: r.valor,
  }));
}
