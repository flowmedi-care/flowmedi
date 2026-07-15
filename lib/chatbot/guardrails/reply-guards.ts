import type { AiState } from "../state/types";
import { isFilled } from "@/lib/attendance-flow/data-resolver";
import { renderSlotList } from "../tools/render-structured";

const CONFIRMED_PATTERN =
  /\b(confirmad[oa]|agendamento (feito|confirmado|realizado)|está marcad[oa]|consulta marcada)\b/i;

/** LLM inventing a slot selection without pending_slot in state. */
const SLOT_SELECTION_CLAIM_PATTERN =
  /\b(voc[eê]\s+escolheu|escolheu\s+o\s+hor[aá]rio|confirma\s+que\s+deseja\s+(remarcar|agendar).*hor[aá]rio)\b/i;

const PHONE_ASK_PATTERN =
  /\b(me (passe|passar|informe|diga) (o |seu )?telefone|qual (é |o )?seu telefone|preciso do (seu )?telefone|número de telefone)\b/i;

const CPF_ASK_PATTERN =
  /\b(preciso do seu CPF|me (passe|passar|informe) (o |seu )?CPF|qual (é |o )?seu CPF|CPF para finalizar)\b/i;

const INSURANCE_ASK_PATTERN =
  /\b(você tem (um )?conv[eê]nio|qual (é o )?conv[eê]nio|tem conv[eê]nio)\b/i;

/**
 * Minimal absurdity shield — not the conversation brain.
 * Known/Missing prompt + GapResolver drive normal flow.
 */
export function applyReplyGuards(reply: string, state: AiState): string {
  let out = reply.trim();
  const bookingDone = state.booking?.status === "done";
  const collected = state.conversation_flow?.collected ?? {};
  const pendingSlot = state.booking?.pending_slot?.trim();
  const offered = state.booking?.offered_slots ?? [];

  if (!bookingDone && CONFIRMED_PATTERN.test(out)) {
    return "Ainda estou finalizando o agendamento. Um momento, por favor.";
  }

  // Contract: never affirm a slot choice without pending_slot in state.
  if (!pendingSlot && SLOT_SELECTION_CLAIM_PATTERN.test(out)) {
    if (offered.length > 0) {
      return renderSlotList({ slots: offered }).text;
    }
    return "Qual horário você prefere? Posso listar as opções disponíveis.";
  }

  if (PHONE_ASK_PATTERN.test(out)) {
    return (
      out.replace(PHONE_ASK_PATTERN, "").trim() ||
      "Já tenho seu número pelo WhatsApp. Só preciso confirmar seu nome, se ainda não estiver cadastrado."
    );
  }

  if (CPF_ASK_PATTERN.test(out) && isFilled(collected.cpf)) {
    return (
      "Já tenho seu CPF cadastrado. " +
      (pendingSlot
        ? "Posso confirmar o horário escolhido?"
        : "Como posso ajudar a continuar o agendamento?")
    );
  }

  if (INSURANCE_ASK_PATTERN.test(out) && isFilled(collected.insurance)) {
    return (
      `Já consta o convênio ${String(collected.insurance)} no seu cadastro. ` +
      (pendingSlot
        ? "Posso confirmar o horário escolhido?"
        : "Quer continuar o agendamento?")
    );
  }

  return out;
}
