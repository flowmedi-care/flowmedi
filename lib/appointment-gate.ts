import type { SupabaseClient } from "@supabase/supabase-js";

export type AppointmentGateResult =
  | { ok: true; appointment: Record<string, unknown>; service_id: string | null; valor: number | null }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "schema_error"; message: string };

const BASE_SELECT = `
  id,
  scheduled_at,
  status,
  notes,
  doctor_id,
  patient:patients ( id, full_name, email, phone, birth_date, cpf ),
  doctor:profiles!doctor_id ( id, full_name ),
  appointment_type:appointment_types ( id, name ),
  procedure:procedures ( id, name )
`;

const BASE_SELECT_ATENDIMENTO = `
  id,
  scheduled_at,
  status,
  doctor_id,
  patient:patients ( id, full_name, email, phone, birth_date, cpf ),
  doctor:profiles!doctor_id ( id, full_name ),
  appointment_type:appointment_types ( id, name ),
  procedure:procedures ( id, name )
`;

export async function loadAppointmentGate(
  supabase: SupabaseClient,
  appointmentId: string,
  clinicId: string,
  opts?: { includeNotes?: boolean }
): Promise<AppointmentGateResult> {
  const select = opts?.includeNotes === false ? BASE_SELECT_ATENDIMENTO : BASE_SELECT;

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(select)
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error?.code === "PGRST116" || (!error && !appointment)) {
    return { ok: false, kind: "not_found" };
  }
  if (error) {
    return { ok: false, kind: "schema_error", message: error.message };
  }

  let service_id: string | null = null;
  let valor: number | null = null;
  const { data: pricing, error: pricingErr } = await supabase
    .from("appointments")
    .select("service_id, valor")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!pricingErr && pricing) {
    service_id = pricing.service_id != null ? String(pricing.service_id) : null;
    valor = pricing.valor != null ? Number(pricing.valor) : null;
  }

  return {
    ok: true,
    appointment: appointment as unknown as Record<string, unknown>,
    service_id,
    valor,
  };
}
