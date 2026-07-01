import type { SupabaseClient } from "@supabase/supabase-js";

export async function collectNpsFeedbackViaAssistant(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    patientId: string;
    conversationId?: string;
    appointmentId?: string;
    score: number;
    comment?: string;
  }
): Promise<{ error: string | null }> {
  const score = Math.round(opts.score);
  if (score < 0 || score > 10) {
    return { error: "Nota deve ser entre 0 e 10." };
  }

  const { error } = await supabase.from("patient_nps_feedback").insert({
    clinic_id: opts.clinicId,
    patient_id: opts.patientId,
    conversation_id: opts.conversationId ?? null,
    appointment_id: opts.appointmentId ?? null,
    score,
    comment: opts.comment?.trim() || null,
    source: "whatsapp_assistant",
  });

  if (error) return { error: error.message };

  try {
    await supabase.rpc("create_event_timeline", {
      p_clinic_id: opts.clinicId,
      p_event_code: "appointment_completed",
      p_patient_id: opts.patientId,
      p_appointment_id: opts.appointmentId ?? null,
      p_metadata: {
        nps_score: score,
        nps_comment: opts.comment ?? null,
        source: "virtual_assistant_nps",
      },
    });
  } catch (e) {
    console.warn("[nps] event:", e);
  }

  return { error: null };
}
