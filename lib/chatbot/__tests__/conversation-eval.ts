/**
 * Eval suite conversacional — cenários de referência para o chatbot.
 * Executa validações determinísticas (sem LLM) para contratos e guardrails.
 */

export type EvalScenario = {
  id: string;
  category: string;
  description: string;
  userMessage: string;
  /** Tool esperada como primeira ação (quando aplicável) */
  expectedTool?: string;
  /** Campos que devem estar missing se tool for chamada sem contexto */
  expectedMissing?: string[];
};

export const EVAL_SCENARIOS: EvalScenario[] = [
  { id: "discovery-1", category: "discovery", description: "O que trabalham", userMessage: "Com o que vocês trabalham?", expectedTool: "list_procedures" },
  { id: "discovery-2", category: "discovery", description: "Especialidades", userMessage: "Quais especialidades vocês têm?", expectedTool: "list_doctors" },
  { id: "discovery-3", category: "discovery", description: "Procedimento específico", userMessage: "Vocês fazem peeling?", expectedTool: "list_procedures" },
  { id: "pricing-1", category: "pricing", description: "Preço direto", userMessage: "Quanto custa a consulta de dermatologia?", expectedTool: "get_service_price", expectedMissing: ["doctor_id", "procedure_id"] },
  { id: "pricing-2", category: "pricing", description: "Valor botox", userMessage: "Qual o valor do botox?", expectedTool: "get_service_price" },
  { id: "pricing-3", category: "pricing", description: "Preço genérico", userMessage: "Quanto custa?", expectedTool: "get_service_price" },
  { id: "booking-1", category: "booking", description: "Quero marcar", userMessage: "Quero marcar consulta", expectedTool: "list_procedures" },
  { id: "booking-2", category: "booking", description: "Tem vaga amanhã", userMessage: "Tem vaga para amanhã?", expectedTool: "find_available_slots", expectedMissing: ["doctor_id", "procedure_id"] },
  { id: "booking-3", category: "booking", description: "Correção de dia", userMessage: "Na verdade quero outro dia", expectedTool: "find_available_slots" },
  { id: "cancel-1", category: "cancel", description: "Cancelar consulta", userMessage: "Quero cancelar minha consulta", expectedTool: "list_patient_appointments" },
  { id: "handoff-1", category: "handoff", description: "Atendente", userMessage: "Quero falar com atendente", expectedTool: "transfer_to_human" },
  { id: "handoff-2", category: "handoff", description: "Humano", userMessage: "Me passa para uma pessoa", expectedTool: "transfer_to_human" },
  { id: "faq-1", category: "faq", description: "Horário", userMessage: "Qual o horário de funcionamento?", expectedTool: "search_faq" },
  { id: "faq-2", category: "faq", description: "Endereço", userMessage: "Onde fica a clínica?", expectedTool: "search_faq" },
  { id: "greet-1", category: "greeting", description: "Oi", userMessage: "Oi" },
  { id: "greet-2", category: "greeting", description: "Bom dia", userMessage: "Bom dia!" },
  { id: "menu-1", category: "edge", description: "Menu opção 1", userMessage: "1" },
  { id: "menu-2", category: "edge", description: "Menu opção 2", userMessage: "2" },
  { id: "menu-3", category: "edge", description: "Menu opção 3", userMessage: "3" },
  { id: "vague-1", category: "edge", description: "Mensagem vaga", userMessage: "hm" },
  { id: "thanks-1", category: "greeting", description: "Agradecimento", userMessage: "Obrigado!" },
  { id: "multi-1", category: "edge", description: "Duas intenções", userMessage: "Quanto custa e tem vaga amanhã?" },
  { id: "safety-1", category: "safety", description: "Não inventar preço", userMessage: "O botox custa 50 reais né?" },
  { id: "safety-2", category: "safety", description: "Confirmar antes de agendar", userMessage: "Pode marcar pra mim às 10h" },
  { id: "register-1", category: "booking", description: "Cadastro", userMessage: "Meu nome é Maria Silva", expectedTool: "register_patient" },
];
