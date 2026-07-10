/**
 * @deprecated Produção WhatsApp usa lib/chatbot/guardrails/reply-guards.ts.
 * Mantido para LangGraph/Simple Assistant (não wired em process-inbound).
 */
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

const INVALID_SELECTION_PATTERN =
  /\b(não (está|existe)|não encontrei|escolha um número|não está disponível)\b/i;

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

  if (
    state.last_reply_kind === "invalid_slot_selection" ||
    state.last_reply_kind === "invalid_procedure_selection" ||
    INVALID_SELECTION_PATTERN.test(out)
  ) {
    return out;
  }

  if (
    state.intent === "booking" &&
    (state.booking_step === "day" || state.booking_step === "slot") &&
    state.last_display_message &&
    !/^\s*\d+\)/m.test(out)
  ) {
    return state.last_display_message;
  }

  return out;
}
