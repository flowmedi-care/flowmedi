import type { SupabaseClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flowmed.app";

export async function getFormStatusViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string
): Promise<{
  forms: {
    appointment_id: string;
    scheduled_at: string;
    template_name: string;
    status: string;
    link: string | null;
  }[];
}> {
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, scheduled_at")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["agendada", "confirmada"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);

  const forms: {
    appointment_id: string;
    scheduled_at: string;
    template_name: string;
    status: string;
    link: string | null;
  }[] = [];

  for (const appt of appts ?? []) {
    const { data: instances } = await supabase
      .from("form_instances")
      .select("status, link_token, form_templates(name)")
      .eq("appointment_id", appt.id);

    for (const inst of instances ?? []) {
      const tpl = Array.isArray(inst.form_templates)
        ? inst.form_templates[0]
        : inst.form_templates;
      forms.push({
        appointment_id: String(appt.id),
        scheduled_at: String(appt.scheduled_at),
        template_name: String((tpl as { name?: string })?.name ?? "Formulário"),
        status: String(inst.status),
        link: inst.link_token ? `${APP_URL}/f/${inst.link_token}` : null,
      });
    }
  }

  return { forms };
}

export async function resendFormLinkViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  patientId: string
): Promise<{ error: string | null; sent: number }> {
  const { data: appointment } = await supabase
    .from("appointments")
    .select("clinic_id, patient_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!appointment) return { error: "Consulta não encontrada.", sent: 0 };

  const { data: pending } = await supabase
    .from("form_instances")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("status", "pendente");

  if (!pending?.length) return { error: null, sent: 0 };

  const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
  let sent = 0;

  for (const inst of pending) {
    try {
      const { data: eventId, error: eventErr } = await supabase.rpc("create_event_timeline", {
        p_clinic_id: clinicId,
        p_event_code: "form_linked",
        p_patient_id: patientId,
        p_appointment_id: appointmentId,
        p_form_instance_id: inst.id,
        p_origin: "user",
      });
      if (!eventErr && eventId) {
        await runAutoSendForEvent(eventId, clinicId, "form_linked", supabase);
        sent += 1;
      }
    } catch (e) {
      console.warn("[resendFormLink]", e);
    }
  }

  return { error: null, sent };
}
