import type { AiConversationState } from "./types";
import type { BookingStep } from "./types";

const INTENT_LABELS: Record<string, string> = {
  booking: "agendamento em andamento",
  pricing: "consulta de preços",
  my_appointments: "consultando agendamentos do paciente",
  confirm_appointment: "aguardando confirmação de presença",
  cancel: "cancelamento",
  payment: "questão de pagamento",
  form: "formulário",
};

const STEP_LABELS: Record<BookingStep, string> = {
  procedure: "escolher procedimento",
  doctor: "escolher profissional",
  day: "escolher dia",
  slot: "escolher horário",
  patient: "confirmar nome/dados",
  confirm: "finalizar no sistema",
  done: "concluído",
};

export function getBookingStepLabel(step?: BookingStep): string {
  if (!step) return "início do agendamento";
  return STEP_LABELS[step] ?? step;
}

/** Formata ai_state para o prompt sem expor JSON cru nem UUIDs desnecessários. */
export function formatAiStateForPrompt(state: AiConversationState): string {
  const lines: string[] = [];

  if (state.intent) {
    lines.push(`Fluxo: ${INTENT_LABELS[state.intent] ?? state.intent}`);
  }
  if (state.booking_step) {
    lines.push(`Etapa do agendamento: ${getBookingStepLabel(state.booking_step)}`);
  }
  if (state.last_created_appointment_id) {
    lines.push("Agendamento já registrado no sistema — não ofereça outros horários para o mesmo pedido.");
  }
  if (state.patient_id) {
    lines.push("Paciente já identificado no sistema.");
  }
  if (state.procedure_id) {
    lines.push("Procedimento já selecionado — não pergunte de novo.");
  }
  if (state.doctor_id) {
    lines.push("Médico já selecionado — não pergunte de novo.");
  }
  if ((state.offered_days?.length ?? 0) > 0) {
    lines.push(
      `Dias oferecidos ao paciente: ${state.offered_days!.length} opção(ões) — use a lista numerada anterior ou interprete dia/turno na mensagem atual.`
    );
  }
  if ((state.offered_slots?.length ?? 0) > 0) {
    lines.push(
      `Horários oferecidos: ${state.offered_slots!.length} opção(ões) — paciente deve escolher um horário da lista.`
    );
  }
  if (state.last_display_message) {
    lines.push("Última lista enviada ao paciente está no histórico recente — não repita menu genérico.");
  }
  if (state.pending_slot) {
    lines.push(`Horário em análise: ${state.pending_slot}`);
  }
  if (state.pending_confirmation_appointment_id) {
    lines.push("Aguardando resposta sim/não para confirmação de consulta.");
  }
  if (state.pending_reschedule_appointment_id) {
    lines.push("Paciente pode estar remarcando consulta existente.");
  }
  if (state.journey_step_code) {
    lines.push(`Etapa CRM: ${state.journey_step_code}`);
  }
  if (state.pipeline_stage) {
    lines.push(`Pipeline agente: ${state.pipeline_stage}`);
  }
  if (state.pending_tool_confirmation) {
    lines.push("Aguardando confirmação sim/não para ação pendente.");
  }
  if (state.contact_intent) {
    lines.push(`Intenção do contato: ${state.contact_intent}`);
  }
  if (state.motivo_provavel) {
    lines.push(`Motivo provável: ${state.motivo_provavel}`);
  }

  if (!lines.length) {
    return "Nenhum fluxo em andamento — trate a mensagem atual como novo pedido.";
  }
  return lines.join("\n");
}

export function buildToolRoundLimitFallback(state: AiConversationState): string {
  if (state.intent === "booking") {
    if (!state.procedure_id) {
      return "Para buscar horários, preciso saber qual procedimento ou tipo de consulta você quer.";
    }
    if (!state.doctor_id) {
      return "Com qual profissional você prefere agendar?";
    }
    if (!state.offered_slots?.length && !state.offered_days?.length && !state.pending_slot) {
      return "Qual dia ou turno (manhã/tarde) funciona melhor para você?";
    }
    return "Falta só confirmar o horário escolhido. Pode repetir qual opção você prefere?";
  }
  if (state.intent === "pricing") {
    return "Qual procedimento ou serviço você quer saber o valor?";
  }
  if (state.intent === "my_appointments") {
    return "Vou verificar suas consultas — um momento. Se não aparecer, me diga seu nome completo.";
  }
  return "Preciso de um detalhe a mais para continuar. O que você precisa: agendar, valores ou falar com a equipe?";
}
