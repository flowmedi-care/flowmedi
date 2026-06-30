import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncPipelineLifecycleByPatientEmail(
  supabase: SupabaseClient,
  clinicId: string,
  email: string,
  lifecycleStage: "oportunidade" | "cliente" | "qualificado",
  userId?: string,
  notes?: string
) {
  const emailLower = email.toLowerCase().trim();
  const { data: pipelineItem } = await supabase
    .from("non_registered_pipeline")
    .select("id, stage, lifecycle_stage")
    .eq("clinic_id", clinicId)
    .eq("email", emailLower)
    .maybeSingle();

  if (!pipelineItem) return;

  const legacyStage =
    lifecycleStage === "oportunidade" || lifecycleStage === "cliente"
      ? "agendado"
      : lifecycleStage === "qualificado"
        ? "cadastrado"
        : pipelineItem.stage;

  await supabase
    .from("non_registered_pipeline")
    .update({
      stage: legacyStage,
      lifecycle_stage: lifecycleStage,
    })
    .eq("id", pipelineItem.id);

  if (userId) {
    await supabase.from("non_registered_history").insert({
      pipeline_id: pipelineItem.id,
      action_by: userId,
      action_type: "stage_change",
      old_stage: pipelineItem.stage,
      new_stage: legacyStage,
      notes: notes ?? `Funil: ${lifecycleStage}`,
    });
  }
}

/** Marca pipeline como cliente na primeira consulta realizada do paciente */
export async function markPipelineClienteIfFirstAppointment(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  userId?: string
) {
  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", patientId)
    .single();

  if (!patient?.email) return;

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("status", "realizada");

  if ((count ?? 0) !== 1) return;

  await syncPipelineLifecycleByPatientEmail(
    supabase,
    clinicId,
    patient.email,
    "cliente",
    userId,
    "Primeira consulta realizada"
  );
}
