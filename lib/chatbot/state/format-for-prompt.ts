import type { AiState } from "./types";

const STEP_LABELS: Record<string, string> = {
  collecting: "coletando dados do agendamento",
  confirming: "aguardando confirmação do horário",
  done: "agendamento concluído",
};

/** Formata ai_state para o prompt sem expor JSON cru. */
export function formatChatbotAiStateForPrompt(state: AiState): string {
  const lines: string[] = [];

  if (state.patient_id) {
    lines.push("Paciente já identificado no sistema.");
  }
  if (state.booking?.procedure_id) {
    lines.push("Procedimento já selecionado — não pergunte de novo.");
  }
  if (state.booking?.doctor_id) {
    lines.push("Médico já selecionado — não pergunte de novo.");
  } else if (state.booking?.procedure_id || state.booking?.pending_slot) {
    lines.push(
      "Médico AINDA NÃO selecionado — chame list_doctors antes de find_available_slots ou create_appointment."
    );
  }
  if (state.booking?.status) {
    lines.push(`Status do agendamento: ${STEP_LABELS[state.booking.status] ?? state.booking.status}.`);
  }
  if ((state.offered_procedures?.length ?? 0) > 0) {
    lines.push("Procedimentos oferecidos — use o id da opção escolhida:");
    for (const p of state.offered_procedures!) {
      lines.push(`  ${p.index ?? "?"}. ${p.name} → id: ${p.id}`);
    }
  }
  if ((state.offered_doctors?.length ?? 0) > 0) {
    lines.push("Médicos oferecidos — use o id da opção escolhida:");
    for (const d of state.offered_doctors!) {
      lines.push(`  ${d.index ?? "?"}. ${d.name} → id: ${d.id}`);
    }
  }
  if ((state.offered_days?.length ?? 0) > 0) {
    lines.push(
      `Dias oferecidos: ${state.offered_days!.length} opção(ões) numeradas — se o paciente responder "1", "2" ou mencionar dia da semana, use a data correspondente.`
    );
  }
  if ((state.booking?.offered_slots?.length ?? 0) > 0) {
    const slots = state.booking!.offered_slots!;
    lines.push(
      `Horários oferecidos (${slots.length}) — paciente escolhe por número ou horário:`
    );
    slots.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.display} → scheduled_at: ${s.scheduled_at}`);
    });
  }
  if (state.booking?.pending_slot) {
    lines.push(
      `Horário selecionado (pending_slot): ${state.booking.pending_slot} — use EXATAMENTE este ISO em create_appointment.`
    );
  }
  if (state.booking?.date) {
    lines.push(`Data em análise: ${state.booking.date}.`);
  }
  if (state.focused_appointment_id) {
    lines.push("Consulta focada para cancelamento/remarcação.");
  }

  if (!lines.length) {
    return "Nenhum fluxo em andamento — trate a mensagem atual como novo pedido.";
  }
  return lines.join("\n");
}

export function buildChatbotFallbackReply(state: AiState): string {
  if (state.booking?.status === "collecting" || state.booking?.status === "confirming") {
    if (!state.booking.procedure_id && !state.offered_procedures?.length) {
      return "Para agendar, preciso saber qual procedimento ou tipo de consulta você quer.";
    }
    if (!state.booking.doctor_id && !state.offered_doctors?.length) {
      return "Com qual profissional você prefere agendar?";
    }
    if (!state.booking.offered_slots?.length && !state.booking.date) {
      return "Qual dia ou turno (manhã/tarde) funciona melhor para você?";
    }
    return "Falta só confirmar o horário escolhido. Pode repetir qual opção você prefere?";
  }
  return "Preciso de um detalhe a mais para continuar. O que você precisa: agendar, valores ou falar com a equipe?";
}
