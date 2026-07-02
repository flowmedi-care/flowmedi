import type { PromptFlow } from "./prompt-decision";

export type FewShotExample = {
  flow: PromptFlow | "all";
  user: string;
  thought: string;
  assistant: string;
};

/** Exemplos few-shot — aumentam aderência sem inflar regras genéricas. */
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  { flow: "general", user: "Oi", thought: "Saudação genérica — menu curto.", assistant: "Olá! Posso ajudar com:\n1) Agendar\n2) Valores\n3) Horários\n4) Minhas consultas\n5) Atendente\nO que você precisa?" },
  { flow: "booking", user: "Quero agendar endoscopia", thought: "Intenção clara — list_procedures, não menu.", assistant: "Claro. Vou ver os procedimentos disponíveis — um momento." },
  { flow: "booking", user: "Com o Dr. Daniel", thought: "Médico escolhido — find_available_slots sem date.", assistant: "Beleza. Vou buscar os próximos dias com o Dr. Daniel." },
  { flow: "booking", user: "Quinta de manhã", thought: "find_available_slots com date e period manha.", assistant: "Vou ver os horários da manhã na quinta." },
  { flow: "booking", user: "Pode ser às 9h", thought: "lookup_patient + create_appointment — telefone já vem do WhatsApp.", assistant: "Perfeito. Vou confirmar seus dados e finalizar o agendamento." },
  { flow: "booking", user: "Qual meu telefone? Você não tem?", thought: "Telefone já disponível — nunca pedir.", assistant: "Já tenho seu número pelo WhatsApp. Só preciso confirmar seu nome completo para finalizar." },
  { flow: "booking", user: "Em qual etapa do fluxo eu estou?", thought: "Responder com estado — não inventar.", assistant: "Estamos escolhendo o horário. Falta confirmar o agendamento no sistema." },
  { flow: "booking", user: "Certeza que o horário está ocupado? Não é minha consulta?", thought: "list_patient_appointments antes de oferecer outro horário.", assistant: "Boa pergunta — vou verificar suas consultas agendadas agora." },
  { flow: "booking", user: "Não", thought: "Paciente recusou dias — find_available_slots com skip_days.", assistant: "Sem problema. Vou buscar outros dias disponíveis." },
  { flow: "pricing", user: "Quanto custa?", thought: "Perguntar procedimento antes de preço.", assistant: "Temos vários serviços. Qual procedimento você quer saber o valor?" },
  { flow: "pricing", user: "Consulta particular", thought: "list_price_options depois get_service_price.", assistant: "Vou consultar as opções de preço para você." },
  { flow: "pricing", user: "Aceita Unimed?", thought: "list_price_options com convênio.", assistant: "Vou verificar os valores para Unimed." },
  { flow: "appointments", user: "Quando é minha consulta?", thought: "list_patient_appointments.", assistant: "Vou verificar suas consultas agendadas." },
  { flow: "appointments", user: "Quero cancelar minha consulta", thought: "list_patient_appointments primeiro.", assistant: "Claro. Vou localizar sua consulta para cancelar." },
  { flow: "appointments", user: "Quero remarcar", thought: "list_patient_appointments + find_available_slots.", assistant: "Sem problema. Vou ver sua consulta atual e buscar novos horários." },
  { flow: "general", user: "Qual o endereço?", thought: "Dado factual da clínica — responder direto.", assistant: "O endereço está nos dados da clínica acima. Quer que eu envie o link do Maps?" },
  { flow: "general", user: "Vocês abrem sábado?", thought: "Horários nos dados da clínica.", assistant: "Consulto os horários de funcionamento e te respondo." },
  { flow: "general", user: "Obrigado", thought: "Encerramento curto.", assistant: "Disponha! Se precisar de mais alguma coisa, estou por aqui." },
  { flow: "general", user: "Quero falar com atendente", thought: "transfer_to_human — pedido explícito.", assistant: "Certo, vou chamar alguém da equipe para continuar seu atendimento." },
  { flow: "booking", user: "Meu nome é Maria Silva", thought: "register_patient se não cadastrada — phone automático.", assistant: "Obrigada, Maria. Vou finalizar seu cadastro e o agendamento." },
  { flow: "booking", user: "Sim, confirmo", thought: "Só create_appointment após slot escolhido.", assistant: "Perfeito. Estou registrando sua consulta no sistema." },
  { flow: "pricing", user: "Quanto custa endoscopia?", thought: "list_price_options para procedimento.", assistant: "Vou consultar o valor da endoscopia." },
  { flow: "general", user: "Quais convênios?", thought: "list_price_options ou FAQ.", assistant: "Vou verificar as opções de convênio disponíveis." },
  { flow: "appointments", user: "Confirmo presença", thought: "confirm_appointment com id da consulta.", assistant: "Ótimo. Vou confirmar sua presença." },
  { flow: "general", user: "Já paguei o pix", thought: "get_payment_status — não confirmar pagamento.", assistant: "Vou verificar o que consta no sistema. A equipe valida comprovantes manualmente." },
  { flow: "general", user: "Preciso do formulário", thought: "get_form_status ou resend_form_link.", assistant: "Vou verificar o status do seu formulário." },
  { flow: "booking", user: "Tem vaga hoje?", thought: "find_available_slots com date hoje.", assistant: "Vou verificar se há horário hoje." },
  { flow: "booking", user: "2", thought: "Escolha numérica de menu — avançar fluxo.", assistant: "Valores e convênios — qual procedimento você quer saber o preço?" },
  { flow: "general", user: "Bom dia", thought: "Saudação — menu ou pergunta direta.", assistant: "Bom dia! Como posso ajudar hoje?" },
  { flow: "pricing", user: "Orçamento formal", thought: "resolve_quote_offer.", assistant: "Vou preparar as informações para seu orçamento." },
  { flow: "appointments", user: "Não vou poder ir", thought: "cancel_appointment após listar.", assistant: "Entendi. Quer cancelar ou prefere remarcar?" },
  { flow: "booking", user: "Pode ser à tarde", thought: "find_available_slots period tarde.", assistant: "Vou buscar horários no período da tarde." },
  { flow: "general", user: "O que vocês fazem?", thought: "list_procedures ou list_services.", assistant: "Vou listar os procedimentos que realizamos." },
  { flow: "booking", user: "Qualquer médico", thought: "list_doctors e deixar paciente escolher ou primeiro disponível.", assistant: "Temos estes profissionais disponíveis — tem preferência?" },
  { flow: "general", user: "ATIVAR", thought: "Comando do sistema — não é escopo do assistente.", assistant: "(comando tratado pelo sistema)" },
  { flow: "booking", user: "Tá confirmado então?", thought: "Verificar last_created_appointment_id — não assumir.", assistant: "Deixa eu confirmar no sistema se sua consulta foi registrada." },
  { flow: "pricing", user: "Tem desconto?", thought: "FAQ ou políticas — não inventar.", assistant: "Vou verificar se há promoções ativas." },
  { flow: "appointments", user: "Minha consulta é amanhã?", thought: "list_patient_appointments.", assistant: "Vou conferir sua agenda." },
  { flow: "general", user: "Como funciona a consulta?", thought: "get_procedure_info.", assistant: "Qual procedimento você quer saber mais detalhes?" },
  { flow: "booking", user: "Endoscopia com sedação", thought: "list_procedures para match.", assistant: "Vou verificar os tipos de endoscopia disponíveis." },
  { flow: "general", user: "?", thought: "Mensagem ambígua — perguntar objetivo.", assistant: "Não entendi bem. Você quer agendar, saber preços ou falar com a equipe?" },
];

export function buildPromptExamples(flow: PromptFlow): string {
  const examples = FEW_SHOT_EXAMPLES.filter((e) => e.flow === flow || e.flow === "all").slice(0, 15);
  const lines = [`# Exemplos (siga o padrão)`, ``];
  for (const ex of examples) {
    lines.push(`Usuário: ${ex.user}`);
    lines.push(`Raciocínio: ${ex.thought}`);
    lines.push(`Resposta: ${ex.assistant}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
