import type { AiConversationState } from "./types";

const INTENT_LABELS: Record<string, string> = {
  booking: "agendamento em andamento",
  pricing: "consulta de preços",
  my_appointments: "consultando agendamentos do paciente",
  confirm_appointment: "aguardando confirmação de presença",
  cancel: "cancelamento",
  payment: "questão de pagamento",
  form: "formulário",
};

/** Formata ai_state para o prompt sem expor JSON cru nem UUIDs desnecessários. */
export function formatAiStateForPrompt(state: AiConversationState): string {
  const lines: string[] = [];

  if (state.intent) {
    lines.push(`Fluxo: ${INTENT_LABELS[state.intent] ?? state.intent}`);
  }
  if (state.pending_step) {
    lines.push(`Etapa pendente: ${state.pending_step}`);
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
    if (!state.pending_slot) {
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
