import type { AiState } from "./types";
import { formatWhenLabel } from "../tools/render-structured";
import { DEFAULT_CLINIC_TIMEZONE, getZonedYmd } from "@/lib/clinic-timezone";
import { getValidOfferedSlots } from "./selection-context";

const STEP_LABELS: Record<string, string> = {
  collecting: "coletando dados do agendamento",
  confirming: "aguardando confirmação do horário",
  done: "agendamento concluído",
};

function isRescheduleHydrated(state: AiState): boolean {
  return (
    state.conversation_flow?.active_workflow_id === "reschedule" &&
    state.conversation_flow?.current_operation?.status === "active" &&
    Boolean(state.focused_appointment_id?.trim()) &&
    Boolean(state.booking?.doctor_id) &&
    Boolean(state.booking?.procedure_id)
  );
}

function pendingSlotHumanLabel(state: AiState): string {
  const pending = state.booking?.pending_slot?.trim();
  if (!pending) return "";
  const fromOffered = getValidOfferedSlots(state.booking).find(
    (s) => s.scheduled_at === pending
  );
  if (fromOffered?.display) {
    const datePart = state.booking?.date ? ` (${state.booking.date})` : "";
    return `${fromOffered.display}${datePart}`;
  }
  return formatWhenLabel(pending);
}

/** Formata ai_state para o prompt sem expor JSON cru. */
export function formatChatbotAiStateForPrompt(state: AiState): string {
  const lines: string[] = [];

  lines.push(
    `Hoje (clínica, ${DEFAULT_CLINIC_TIMEZONE}): ${getZonedYmd(new Date(), DEFAULT_CLINIC_TIMEZONE)}.`
  );

  if (state.patient_id) {
    lines.push("Paciente já identificado no sistema.");
  }

  const opStatus = state.conversation_flow?.current_operation?.status;
  if (opStatus === "completed") {
    lines.push(
      "Operação atual concluída — não reinicie seleção/confirmação; responda perguntas com o contexto da consulta focada ou list_patient_appointments (modo browse)."
    );
  } else if (opStatus === "abandoned") {
    lines.push(
      "Operação atual encerrada sem conclusão — não reinicie a mesma operação; ajude com um novo pedido (agendar, remarcar, etc.)."
    );
  }

  if (isRescheduleHydrated(state)) {
    lines.push(
      "REMARCAÇÃO: médico e procedimento já definidos pela consulta focada — NÃO pergunte médico nem procedimento; NÃO chame list_doctors.",
      "Próximo objetivo: descobrir apenas o novo dia e/ou horário e usar find_available_slots → reschedule_appointment."
    );
  } else if (state.conversation_flow?.current_operation?.status === "active") {
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
      `Dias oferecidos (${state.offered_days!.length}) — use a data YYYY-MM-DD correspondente (não invente o ano):`
    );
    for (const d of state.offered_days!) {
      lines.push(`  ${d.index ?? "?"}. ${d.label} → date: ${d.date}`);
    }
  }
  if ((getValidOfferedSlots(state.booking).length ?? 0) > 0) {
    const slots = getValidOfferedSlots(state.booking);
    lines.push(
      `Horários oferecidos (${slots.length}) — paciente escolhe por número ou horário:`
    );
    slots.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.display} → scheduled_at: ${s.scheduled_at}`);
    });
  }
  if (state.booking?.pending_slot) {
    const useReschedule =
      state.conversation_flow?.active_workflow_id === "reschedule";
    const human = pendingSlotHumanLabel(state);
    lines.push(
      `Horário selecionado para o paciente: ${human} — NÃO mostre ISO/timezone cru na mensagem.`
    );
    lines.push(
      useReschedule
        ? `Para a tool reschedule_appointment use exatamente pending_slot (interno): ${state.booking.pending_slot}.`
        : `Para a tool create_appointment use exatamente pending_slot (interno): ${state.booking.pending_slot}.`
    );
  }
  if (state.booking?.date) {
    lines.push(`Data em análise: ${state.booking.date}.`);
  }
  if (state.focused_appointment_id) {
    const wf = state.conversation_flow?.active_workflow_id;
    if (wf === "reschedule") {
      lines.push("Consulta focada para remarcação (preserve médico/procedimento).");
    } else if (wf === "check_in") {
      lines.push(
        "Consulta focada para check-in — confirme e chame perform_check_in (não invente elegibilidade)."
      );
    } else {
      lines.push("Consulta focada para cancelamento/remarcação.");
    }
  }

  if (
    state.conversation_flow?.active_workflow_id === "check_in" &&
    state.conversation_flow.pending.includes("check_in") &&
    !state.focused_appointment_id
  ) {
    lines.push(
      "Check-in: liste consultas elegíveis com list_patient_appointments e peça o número."
    );
  }

  if (!lines.length) {
    return "Nenhum fluxo em andamento — trate a mensagem atual como novo pedido.";
  }
  return lines.join("\n");
}

export function buildChatbotFallbackReply(state: AiState): string {
  const opStatus = state.conversation_flow?.current_operation?.status;
  if (opStatus === "completed" || opStatus === "abandoned") {
    return "Posso ajudar com mais alguma coisa?";
  }
  if (isRescheduleHydrated(state)) {
    if (!state.booking?.offered_slots?.length && !state.booking?.date) {
      return "Qual dia ou horário você gostaria de remarcar?";
    }
    return "Qual horário você prefere?";
  }
  if (state.conversation_flow?.active_workflow_id === "check_in") {
    if (state.focused_appointment_id) {
      return "Confirmo o check-in dessa consulta?";
    }
    return "Não há consultas elegíveis para check-in agora. Quer agendar ou tentar mais perto do horário?";
  }
  if (state.booking?.status === "collecting" || state.booking?.status === "confirming") {
    if (!state.booking.procedure_id && !state.offered_procedures?.length) {
      return "Qual procedimento ou tipo de consulta você quer?";
    }
    if (!state.booking.doctor_id && !state.offered_doctors?.length) {
      return "Com qual profissional você prefere?";
    }
    if (!state.booking.offered_slots?.length && !state.booking.date) {
      return "Qual dia ou turno funciona melhor — manhã ou tarde?";
    }
    return "Qual opção de horário você prefere?";
  }
  return "O que você precisa: agendar, saber valores ou falar com a equipe?";
}
