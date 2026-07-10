import type { AiState } from "../state/types";

const CONFIRMED_PATTERN =
  /\b(confirmad[oa]|agendamento (feito|confirmado|realizado)|está marcad[oa]|consulta marcada)\b/i;

const PHONE_ASK_PATTERN =
  /\b(me (passe|passar|informe|diga) (o |seu )?telefone|qual (é |o )?seu telefone|preciso do (seu )?telefone|número de telefone)\b/i;

export function applyReplyGuards(reply: string, state: AiState): string {
  let out = reply.trim();
  const bookingDone = state.booking?.status === "done";

  if (!bookingDone && CONFIRMED_PATTERN.test(out)) {
    return "Ainda estou finalizando o agendamento. Um momento, por favor.";
  }

  if (PHONE_ASK_PATTERN.test(out)) {
    return (
      out.replace(PHONE_ASK_PATTERN, "").trim() ||
      "Já tenho seu número pelo WhatsApp. Só preciso confirmar seu nome, se ainda não estiver cadastrado."
    );
  }

  return out;
}
