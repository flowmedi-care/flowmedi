/**
 * Lógica centralizada de envio por evento.
 * Usado pela UI (card + modal Enviar) e pelo backend (envio automático e manual).
 *
 * Regras:
 * - system_enabled: só define se o evento aparece em Pendentes ou só em Todos (não afeta envio).
 * - Por canal (email / whatsapp):
 *   - enabled + automatic: envia automaticamente ao disparar o evento; manual: usuário envia pelo botão.
 *   - enabled + já enviado: mostra "Já enviado".
 *   - enabled + não enviado: mostra opção de enviar (manual) ou já foi enviado (automatic).
 *   - !enabled: mostra "Envio por [canal] desativado".
 * - Os dois desativados: mostra "Envio desativado".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ChannelSendState = {
  enabled: boolean;
  sendMode: "automatic" | "manual";
  alreadySent: boolean;
  /** Para UI: "envio_desativado" | "ja_enviado" | "enviar" */
  label: "envio_desativado" | "ja_enviado" | "enviar";
};

export type EventSendState = {
  email: ChannelSendState;
  whatsapp: ChannelSendState;
  /** Nenhum canal ativado para este evento */
  allDisabled: boolean;
  /** Todos os canais ativados já foram enviados */
  allSent: boolean;
  /** Canais que podem ser enviados agora (ativados e ainda não enviados) */
  canSendChannels: ("email" | "whatsapp")[];
};

export type SettingForEvent = {
  event_code: string;
  channel: string;
  enabled: boolean;
  send_mode: string;
};

/**
 * Estado de envio por canal para um evento (para UI: card e modal).
 * Usar settings filtrados por event_code (todos os canais desse evento).
 */
export function getChannelSendState(
  event: { event_code: string; sent_channels?: string[] | null },
  settings: SettingForEvent[]
): EventSendState {
  const sent = event.sent_channels ?? [];
  const forEvent = settings.filter((s) => s.event_code === event.event_code);
  const emailSetting = forEvent.find((s) => s.channel === "email");
  const wppSetting = forEvent.find((s) => s.channel === "whatsapp");

  const emailEnabled = emailSetting?.enabled ?? false;
  const wppEnabled = wppSetting?.enabled ?? false;
  const emailSent = sent.includes("email");
  const wppSent = sent.includes("whatsapp");
  const emailSendMode = (emailSetting?.send_mode === "automatic" ? "automatic" : "manual") as "automatic" | "manual";
  const wppSendMode = (wppSetting?.send_mode === "automatic" ? "automatic" : "manual") as "automatic" | "manual";

  const emailLabel: ChannelSendState["label"] = !emailEnabled
    ? "envio_desativado"
    : emailSent
      ? "ja_enviado"
      : "enviar";
  const wppLabel: ChannelSendState["label"] = !wppEnabled
    ? "envio_desativado"
    : wppSent
      ? "ja_enviado"
      : "enviar";

  const canSendChannels: ("email" | "whatsapp")[] = [
    ...(emailEnabled && !emailSent ? (["email"] as const) : []),
    ...(wppEnabled && !wppSent ? (["whatsapp"] as const) : []),
  ];
  const allSent =
    (!emailEnabled || emailSent) && (!wppEnabled || wppSent);

  return {
    email: {
      enabled: emailEnabled,
      sendMode: emailSendMode,
      alreadySent: emailSent,
      label: emailLabel,
    },
    whatsapp: {
      enabled: wppEnabled,
      sendMode: wppSendMode,
      alreadySent: wppSent,
      label: wppLabel,
    },
    allDisabled: !emailEnabled && !wppEnabled,
    allSent,
    canSendChannels,
  };
}

/**
 * Quais canais devem ser enviados automaticamente ao disparar este evento.
 * Usado pelo backend (ex.: após envio de formulário público).
 */
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
  sent_channels: string[] | null;
};

/**
 * Executa o envio para um evento nos canais indicados.
 * - public_form_completed sem patient_id: usa processEventByIdForPublicForm (email; WhatsApp "em breve").
 * - Demais eventos: usa processMessageEvent com patient_id (email/telefone do paciente).
 * Atualiza sent_channels no evento.
 */
export async function executeSendForEvent(
  eventId: string,
  eventData: EventDataForSend,
  channelsToSend: ("email" | "whatsapp")[],
  supabase: SupabaseClient
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
          channel
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
 * Envio automático: para o evento dado, envia nos canais configurados como automáticos.
 * Usado pela API (ex.: após formulário público) e por qualquer trigger futuro.
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
    .select("patient_id, appointment_id, sent_channels")
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
      sent_channels: (eventRow.sent_channels as string[] | null) ?? null,
    },
    channels,
    supabase
  );

  return { sent: result.error === null, error: result.error };
}
