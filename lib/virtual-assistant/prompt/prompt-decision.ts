export type PromptFlow = "booking" | "pricing" | "appointments" | "general";

export function buildPromptDecision(flow: PromptFlow): string {
  const common = [
    `# Fluxo de decisão`,
    `Sempre siga nesta ordem:`,
    `1. Entenda a intenção.`,
    `2. Verifique se existe ferramenta para isso.`,
    `3. Se existir: execute antes de responder.`,
    `4. Se precisar de confirmação: pergunte (uma coisa só).`,
    `5. Depois responda com base no resultado da ferramenta.`,
    `6. Não explique processos internos ao paciente.`,
  ];

  const flowSpecific: Record<PromptFlow, string[]> = {
    booking: [
      ``,
      `## Agendamento`,
      `Ordem: procedimento → médico → dias (find_available_slots) → horários → lookup_patient → register se necessário → create_appointment.`,
      `NUNCA diga "confirmado" ou "agendamento feito" antes de create_appointment retornar appointmentId.`,
      `NUNCA peça telefone — o WhatsApp já fornece.`,
      `Use SOMENTE display_message de find_available_slots para horários.`,
      `Após o paciente escolher dia, chame find_available_slots com date para listar horários antes de create_appointment.`,
      `Só chame create_appointment depois que o paciente escolher um horário específico da lista.`,
      `NUNCA transfer_to_human durante agendamento ativo — finalize com create_appointment.`,
      `Se create_appointment falhar com conflito, chame list_patient_appointments antes de oferecer outro horário.`,
    ],
    pricing: [
      ``,
      `## Preços`,
      `Ordem: identificar procedimento → list_price_options → get_service_price com dimension_value_ids.`,
      `Nunca invente valores.`,
    ],
    appointments: [
      ``,
      `## Consultas existentes`,
      `Use list_patient_appointments antes de confirmar, cancelar ou remarcar.`,
    ],
    general: [
      ``,
      `## Geral`,
      `Se a mensagem for só saudação ("oi", "bom dia"), ofereça menu curto numerado.`,
      `Se a mensagem já indicar intenção, avance direto sem menu.`,
    ],
  };

  return [...common, ...flowSpecific[flow]].join("\n");
}
