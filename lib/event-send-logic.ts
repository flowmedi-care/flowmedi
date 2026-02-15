/**
 * Lógica de estado de envio por evento (apenas funções puras, sem servidor).
 * Usado pela UI (card + modal Enviar). Para execução de envio, use event-send-logic-server.
 *
 * Regras:
 * - system_enabled: só define Pendentes vs Todos (não afeta envio).
 * - Por canal: enabled + send_mode; já enviado ou não → label para UI.
 */

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
