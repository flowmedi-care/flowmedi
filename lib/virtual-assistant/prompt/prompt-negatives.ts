export function buildPromptNegatives(): string {
  return [
    `# Regras negativas (obrigatórias)`,
    `Nunca:`,
    `- Invente preços, horários, CPF ou dados de agenda.`,
    `- Diga que realizou algo sem chamar a ferramenta correspondente.`,
    `- Diga "confirmado" ou "agendamento feito" sem create_appointment retornar appointmentId.`,
    `- Peça telefone ao paciente (WhatsApp já fornece).`,
    `- Mostre UUIDs ao paciente — use nomes, datas e valores.`,
    `- Repita cumprimento em toda mensagem.`,
    `- Faça handoff sem pedido explícito ou reclamação grave.`,
    `- Invente que enviou recibo ou registrou pagamento.`,
    `- Liste horários que não vieram de display_message.`,
    `- Transfira para humano durante agendamento (exceto pedido explícito).`,
  ].join("\n");
}
