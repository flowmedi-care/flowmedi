import type { ContactIntent } from "./types";

const FINANCE_KEYWORDS = [
  "pix",
  "boleto",
  "comprovante",
  "pagamento",
  "pagar",
  "2ª via",
  "segunda via",
  "cobrança",
  "cobranca",
  "valor",
  "débito",
  "debito",
];

const COMPLAINT_KEYWORDS = [
  "reclamação",
  "reclamacao",
  "procon",
  "advogado",
  "processo",
  "insatisfeito",
  "péssimo",
  "pessimo",
];

const HUMAN_HANDOFF_KEYWORDS = [
  "atendente",
  "humano",
  "pessoa",
  "falar com alguém",
  "falar com alguem",
];

export type IntentClassifierInput = {
  messageText?: string | null;
  isNewNumber: boolean;
  hasFutureAppointment: boolean;
  hasCompletedAppointment: boolean;
  isInactivePatient: boolean;
  isLeadInPipeline: boolean;
  isNpsContext?: boolean;
  currentStep?: string | null;
};

export function classifyContactIntent(input: IntentClassifierInput): ContactIntent {
  const text = (input.messageText ?? "").toLowerCase();

  if (COMPLAINT_KEYWORDS.some((k) => text.includes(k))) {
    return "suporte";
  }

  if (FINANCE_KEYWORDS.some((k) => text.includes(k))) {
    return "financeiro";
  }

  if (input.isNpsContext || input.currentStep === "pesquisa_nps_enviada") {
    return "pos_atendimento";
  }

  if (input.hasFutureAppointment) {
    return "operacional";
  }

  if (HUMAN_HANDOFF_KEYWORDS.some((k) => text.includes(k))) {
    return "suporte";
  }

  if (input.isNewNumber && !input.hasCompletedAppointment) {
    return "captacao";
  }

  if (input.isInactivePatient && input.hasCompletedAppointment && !input.hasFutureAppointment) {
    return "reativacao";
  }

  if (input.isLeadInPipeline && !input.hasFutureAppointment) {
    return "captacao";
  }

  if (!input.hasFutureAppointment && !input.isNewNumber && text.length > 0) {
    return "suporte";
  }

  return "captacao";
}

export function inferSourceFromReferral(referral?: {
  source_type?: string;
  source_url?: string;
} | null): string {
  if (!referral) return "whatsapp_direct";
  if (referral.source_type === "ad") return "whatsapp_ads";
  return "whatsapp";
}
