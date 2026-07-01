import type { ContactIntent } from "./types";

export const CONTACT_INTENT_LABELS: Record<ContactIntent, string> = {
  captacao: "Captação",
  reativacao: "Reativação",
  operacional: "Operacional",
  financeiro: "Financeiro",
  suporte: "Suporte",
  pos_atendimento: "Pós-atendimento",
};

export const CONTACT_INTENT_DESCRIPTIONS: Record<ContactIntent, string> = {
  captacao: "Novo lead — funil comercial até o agendamento",
  reativacao: "Ex-paciente ou contato inativo retomando relacionamento",
  operacional: "Agendamento, confirmação ou remarcação em curso",
  financeiro: "Cobrança, pagamento, comprovante ou orçamento",
  suporte: "Dúvidas informativas sem intenção comercial imediata",
  pos_atendimento: "NPS, satisfação ou feedback pós-consulta",
};
