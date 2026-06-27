import type { SupabaseClient } from "@supabase/supabase-js";
import type { LossReasonValue } from "./loss-reasons";

const REPESCAGEM_WINDOW_DAYS = 30;

export async function suggestRepescagemFromAppointment(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string;
    appointmentId: string;
    source: "falta" | "cancelamento";
  }
): Promise<void> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - REPESCAGEM_WINDOW_DAYS);

  const { data: existing } = await supabase
    .from("lead_repescagem")
    .select("id")
    .eq("clinic_id", params.clinicId)
    .eq("patient_id", params.patientId)
    .in("status", ["sugerido", "ativo"])
    .gte("created_at", windowStart.toISOString())
    .maybeSingle();

  if (existing) return;

  const lossReason: LossReasonValue =
    params.source === "falta" ? "faltou_consulta" : "cancelou_consulta";

  await supabase.from("lead_repescagem").insert({
    clinic_id: params.clinicId,
    patient_id: params.patientId,
    appointment_id: params.appointmentId,
    source: params.source,
    status: "sugerido",
    loss_reason: lossReason,
  });
}
