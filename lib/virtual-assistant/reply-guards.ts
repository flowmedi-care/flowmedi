import type { AiConversationState } from "./types";
import { getBookingStepLabel } from "./format-ai-state";

export function isMetaFlowQuestion(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /em qual etapa|qual etapa|onde (estou|paramos)|em que ponto|status do (fluxo|agendamento)/.test(t);
}

export function buildMetaFlowReply(state: AiConversationState): string | null {
  if (state.booking_step === "done" || state.last_created_appointment_id) {
    return "Seu agendamento já foi registrado no sistema. Precisa de mais alguma coisa?";
  }
  if (state.booking_step) {
    return `Estamos na etapa de ${getBookingStepLabel(state.booking_step)}.`;
  }
  if (state.intent === "booking") {
    return "Estamos no fluxo de agendamento. Me diga o procedimento ou profissional, se ainda não escolheu.";
  }
  return null;
}

const CONFIRMED_PATTERN =
  /\b(confirmad[oa]|agendamento (feito|confirmado|realizado)|está marcad[oa]|consulta marcada)\b/i;

const PHONE_ASK_PATTERN =
  /\b(me (passe|passar|informe|diga) (o |seu )?telefone|qual (é |o )?seu telefone|preciso do (seu )?telefone|número de telefone)\b/i;

export function applyReplyGuards(
  reply: string,
  state: AiConversationState
): string {
  let out = reply.trim();
  const bookingDone =
    state.booking_step === "done" || Boolean(state.last_created_appointment_id);

  if (!bookingDone && CONFIRMED_PATTERN.test(out)) {
    const step = state.booking_step ?? "confirm";
    return `Ainda estou finalizando. Estamos na etapa de ${getBookingStepLabel(step)} — um momento.`;
  }

  if (PHONE_ASK_PATTERN.test(out)) {
    return out.replace(PHONE_ASK_PATTERN, "").trim() ||
      "Já tenho seu número pelo WhatsApp. Só preciso confirmar seu nome, se ainda não estiver cadastrado.";
  }

  return out;
}
