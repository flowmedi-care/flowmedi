import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAssistantReply } from "./send-reply";
import { isVirtualAssistantActive } from "./process-inbound";
import { isInsideAutoMessageWindow } from "@/lib/whatsapp-ops-controls";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

function formatAppointmentConfirmMessage(appt: {
  scheduled_at: string;
  doctor_name: string;
  procedure_name?: string;
}): string {
  const dt = new Date(appt.scheduled_at);
  const date = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const proc = appt.procedure_name ? ` (${appt.procedure_name})` : "";
  return `Olá! Passando para confirmar sua consulta${proc} com ${appt.doctor_name} no dia ${date} às ${time}. Você confirma presença? Responda *sim* ou *não*.`;
}

/**
 * Envia mensagens proativas de confirmação de consulta via assistente virtual.
 */
export async function runVirtualAssistantConfirmations(
  supabase: SupabaseClient,
  clinicIdFilter?: string
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  let clinicsQuery = supabase
    .from("clinic_virtual_assistant_settings")
    .select("clinic_id, enabled")
    .eq("enabled", true);

  if (clinicIdFilter) {
    clinicsQuery = clinicsQuery.eq("clinic_id", clinicIdFilter);
  }

  const { data: enabledClinics } = await clinicsQuery;
  if (!enabledClinics?.length) return { sent, errors };

  for (const row of enabledClinics) {
    const clinicId = row.clinic_id;
    const { active } = await isVirtualAssistantActive(supabase, clinicId);
    if (!active) continue;

    if (!(await isInsideAutoMessageWindow(clinicId, supabase))) continue;

    const { data: clinic } = await supabase
      .from("clinics")
      .select("compliance_confirmation_days")
      .eq("id", clinicId)
      .single();

    const daysBefore = Number(clinic?.compliance_confirmation_days) || 2;
    const targetStart = new Date();
    targetStart.setDate(targetStart.getDate() + daysBefore);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    const { data: appointments } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, scheduled_at, status, procedure_id, doctor_id, patients(phone, full_name), profiles!appointments_doctor_id_fkey(full_name), procedures(name)"
      )
      .eq("clinic_id", clinicId)
      .eq("status", "agendada")
      .gte("scheduled_at", targetStart.toISOString())
      .lte("scheduled_at", targetEnd.toISOString());

    for (const appt of appointments ?? []) {
      const { data: existing } = await supabase
        .from("whatsapp_ai_confirmation_outreach")
        .select("id")
        .eq("appointment_id", appt.id)
        .maybeSingle();

      if (existing) continue;

      const patient = appt.patients as { phone?: string; full_name?: string } | null;
      const phone = patient?.phone;
      if (!phone) continue;

      const normalized = normalizeWhatsAppPhone(phone.replace(/\D/g, ""));
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id, status, last_inbound_message_at")
        .eq("clinic_id", clinicId)
        .eq("phone_number", normalized)
        .maybeSingle();

      const lastInbound = conv?.last_inbound_message_at
        ? new Date(conv.last_inbound_message_at).getTime()
        : 0;
      const within24h = Date.now() - lastInbound < 24 * 60 * 60 * 1000;
      if (!within24h && conv?.status !== "open") continue;

      let conversationId = conv?.id;
      if (!conversationId) {
        const { data: newConv } = await supabase
          .from("whatsapp_conversations")
          .insert({
            clinic_id: clinicId,
            phone_number: normalized,
            status: "open",
            last_inbound_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        conversationId = newConv?.id;
      }
      if (!conversationId) {
        errors++;
        continue;
      }

      const doctor = appt.profiles as { full_name?: string } | null;
      const procedure = appt.procedures as { name?: string } | null;
      const msg = formatAppointmentConfirmMessage({
        scheduled_at: appt.scheduled_at,
        doctor_name: doctor?.full_name ?? "o profissional",
        procedure_name: procedure?.name,
      });

      const ok = await sendAssistantReply(supabase, clinicId, conversationId, normalized, msg);
      if (ok) {
        await supabase.from("whatsapp_ai_confirmation_outreach").insert({
          clinic_id: clinicId,
          appointment_id: appt.id,
          conversation_id: conversationId,
        });
        await supabase
          .from("whatsapp_conversations")
          .update({
            ai_state: {
              intent: "confirm_appointment",
              pending_confirmation_appointment_id: appt.id,
              patient_id: appt.patient_id,
            },
          })
          .eq("id", conversationId);
        sent++;
      } else {
        errors++;
      }
    }
  }

  return { sent, errors };
}

export function parseConfirmationReply(text: string): "yes" | "no" | null {
  const t = text.toLowerCase().trim();
  if (/^(sim|confirmo|confirmado|ok|pode ser|vou|estarei)/.test(t)) return "yes";
  if (/^(não|nao|cancelar|cancela|não vou|nao vou)/.test(t)) return "no";
  return null;
}
