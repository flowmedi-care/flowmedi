/**
 * Execução de envio por evento (apenas servidor).
 * Usado por actions (eventos) e API (process-public-form-event).
 * Não importar em componentes com "use client".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getChannelsToAutoSend(
  clinicId: string,
  eventCode: string,
  supabase: SupabaseClient
): Promise<{ email: boolean; whatsapp: boolean }> {
  const { data: rows } = await supabase
    .from("clinic_message_settings")
    .select("channel, enabled, send_mode")
    .eq("clinic_id", clinicId)
    .eq("event_code", eventCode);

  const email = rows?.find((r) => r.channel === "email");
  const wpp = rows?.find((r) => r.channel === "whatsapp");

  return {
    email: email?.enabled === true && email?.send_mode === "automatic",
    whatsapp: wpp?.enabled === true && wpp?.send_mode === "automatic",
  };
}

export type EventDataForSend = {
  event_code: string;
  clinic_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  form_instance_id?: string | null;
  sent_channels: string[] | null;
};

/**
 * Executa o envio para um evento nos canais indicados.
 * - public_form_completed sem patient_id: processEventByIdForPublicForm (email; WhatsApp "em breve").
 * - Demais eventos: processMessageEvent com patient_id.
 */
export async function executeSendForEvent(
  eventId: string,
  eventData: EventDataForSend,
  channelsToSend: ("email" | "whatsapp")[],
  supabase: SupabaseClient,
  /** Se true, envia imediatamente (ex.: usuário clicou Enviar na Central de Eventos), ignorando send_mode=manual */
  forceImmediateSend = false
): Promise<{ error: string | null }> {
  if (channelsToSend.length === 0) return { error: null };

  const { processMessageEvent, processEventByIdForPublicForm } = await import("@/lib/message-processor");
  const isPublicFormNoPatient =
    eventData.event_code === "public_form_completed" && !eventData.patient_id;

  try {
    const sentThisRound: ("email" | "whatsapp")[] = [];

    if (isPublicFormNoPatient) {
      if (channelsToSend.includes("email")) {
        const result = await processEventByIdForPublicForm(eventId, supabase);
        if (!result.success) return { error: result.error ?? "Erro ao enviar." };
        sentThisRound.push("email");
      }
      if (channelsToSend.includes("whatsapp")) {
        return { error: "Envio por WhatsApp para formulário público em breve." };
      }
    } else {
      if (!eventData.patient_id) {
        return { error: "Evento sem paciente vinculado." };
      }
      for (const channel of channelsToSend) {
        const result = await processMessageEvent(
          eventData.event_code,
          eventData.clinic_id,
          eventData.patient_id,
          eventData.appointment_id || null,
          channel,
          supabase,
          eventData.form_instance_id || undefined,
          forceImmediateSend
        );
        if (!result.success) return { error: result.error ?? "Erro ao enviar." };
        sentThisRound.push(channel);
      }
    }

    const currentSent = eventData.sent_channels ?? [];
    const newSentChannels = Array.from(new Set([...currentSent, ...sentThisRound]));

    const { error: updateError } = await supabase
      .from("event_timeline")
      .update({ sent_channels: newSentChannels })
      .eq("id", eventId);

    if (updateError) return { error: `Erro ao atualizar evento: ${updateError.message}` };
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Erro ao enviar: ${message}` };
  }
}

/**
 * Envio automático: envia nos canais configurados como automáticos para o evento.
 */
export async function runAutoSendForEvent(
  eventId: string,
  clinicId: string,
  eventCode: string,
  supabase: SupabaseClient
): Promise<{ sent: boolean; error: string | null }> {
  const toSend = await getChannelsToAutoSend(clinicId, eventCode, supabase);
  if (!toSend.email && !toSend.whatsapp) {
    return { sent: false, error: null };
  }

  const channels: ("email" | "whatsapp")[] = [
    ...(toSend.email ? (["email"] as const) : []),
    ...(toSend.whatsapp ? (["whatsapp"] as const) : []),
  ];

  const { data: eventRow } = await supabase
    .from("event_timeline")
    .select("patient_id, appointment_id, form_instance_id, sent_channels")
    .eq("id", eventId)
    .single();

  if (!eventRow) return { sent: false, error: "Evento não encontrado." };

  const result = await executeSendForEvent(
    eventId,
    {
      event_code: eventCode,
      clinic_id: clinicId,
      patient_id: eventRow.patient_id ?? null,
      appointment_id: eventRow.appointment_id ?? null,
      form_instance_id: eventRow.form_instance_id ?? null,
      sent_channels: (eventRow.sent_channels as string[] | null) ?? null,
    },
    channels,
    supabase
  );

  return { sent: result.error === null, error: result.error };
}
