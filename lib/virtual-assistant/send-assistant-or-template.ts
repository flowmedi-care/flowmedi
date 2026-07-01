import type { SupabaseClient } from "@supabase/supabase-js";
import { processMessageEvent } from "@/lib/message-processor";
import { getEffectiveTicketStatus } from "@/lib/whatsapp-ticket-status";
import { sendAssistantReply } from "./send-reply";

export type SendAssistantOrTemplateParams = {
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  patientId: string;
  appointmentId?: string | null;
  /** Evento da Central de Eventos usado quando a janela de 24h está fechada */
  eventCode: string;
  /** Texto livre usado quando o ticket está aberto (janela de 24h ativa) */
  fallbackText: string;
  /** Registra evento na timeline para auditoria (apenas no caminho template) */
  recordEvent?: boolean;
  eventMetadata?: Record<string, unknown>;
};

export type SendAssistantOrTemplateResult = {
  success: boolean;
  mode: "free_text" | "template";
  error?: string;
};

/**
 * Envia mensagem proativa do assistente virtual:
 * - Ticket aberto (inbound < 24h): texto livre
 * - Ticket fechado: template Meta via Central de Eventos
 */
export async function sendAssistantOrTemplate(
  supabase: SupabaseClient,
  params: SendAssistantOrTemplateParams
): Promise<SendAssistantOrTemplateResult> {
  const {
    clinicId,
    conversationId,
    phoneNumber,
    patientId,
    appointmentId = null,
    eventCode,
    fallbackText,
    recordEvent = true,
    eventMetadata,
  } = params;

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("status, last_inbound_message_at")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const ticketStatus = getEffectiveTicketStatus(
    conv?.status,
    conv?.last_inbound_message_at
  );

  if (ticketStatus === "open") {
    const ok = await sendAssistantReply(
      supabase,
      clinicId,
      conversationId,
      phoneNumber,
      fallbackText
    );
    return {
      success: ok,
      mode: "free_text",
      error: ok ? undefined : "Falha ao enviar texto livre",
    };
  }

  if (recordEvent) {
    try {
      await supabase.rpc("create_event_timeline", {
        p_clinic_id: clinicId,
        p_event_code: eventCode,
        p_patient_id: patientId,
        p_appointment_id: appointmentId,
        p_metadata: {
          source: "virtual_assistant",
          channel: "whatsapp",
          ...eventMetadata,
        },
      });
    } catch (e) {
      console.warn("[VirtualAssistant] create_event_timeline:", e);
    }
  }

  const result = await processMessageEvent(
    eventCode,
    clinicId,
    patientId,
    appointmentId,
    "whatsapp",
    supabase,
    undefined,
    true,
    eventMetadata,
    true
  );

  return {
    success: result.success,
    mode: "template",
    error: result.error,
  };
}

/**
 * Garante conversa WhatsApp para o paciente (sem simular inbound).
 */
export async function ensureWhatsAppConversation(
  supabase: SupabaseClient,
  clinicId: string,
  normalizedPhone: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("phone_number", normalizedPhone)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from("whatsapp_conversations")
    .insert({
      clinic_id: clinicId,
      phone_number: normalizedPhone,
      status: "closed",
    })
    .select("id")
    .single();

  return created?.id ?? null;
}
