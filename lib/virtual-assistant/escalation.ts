export type EscalationTrigger =
  | "complaint"
  | "human_request"
  | "high_value_negotiation"
  | "confirmation_no_response"
  | "payment_proof_missing"
  | "low_confidence_objection";

export type EscalationInput = {
  messageText?: string | null;
  negotiatedValue?: number | null;
  valueLimit?: number | null;
  followupCount?: number;
  confirmationStep?: boolean;
  lossConfidence?: "alta" | "media" | "baixa" | null;
  activeBooking?: boolean;
};

const COMPLAINT = [/reclama[çc][aã]o/i, /procon/i, /advogado/i, /processo/i];
const HUMAN = [
  /falar com (um(a)? )?(atendente|humano|pessoa)/i,
  /quero (um )?atendente/i,
  /quero falar com (algu[eé]m|uma pessoa)/i,
  /\batendente humano\b/i,
];

export function shouldEscalateToHuman(input: EscalationInput): {
  escalate: boolean;
  trigger?: EscalationTrigger;
  reason?: string;
} {
  const text = (input.messageText ?? "").toLowerCase();

  if (COMPLAINT.some((p) => p.test(text))) {
    return { escalate: true, trigger: "complaint", reason: "Reclamação detectada" };
  }

  if (HUMAN.some((p) => p.test(text))) {
    return { escalate: true, trigger: "human_request", reason: "Pedido explícito de atendente" };
  }

  if (
    input.negotiatedValue != null &&
    input.valueLimit != null &&
    input.negotiatedValue > input.valueLimit
  ) {
    return { escalate: true, trigger: "high_value_negotiation", reason: "Valor acima do limite" };
  }

  if (input.confirmationStep && (input.followupCount ?? 0) >= 2) {
    return { escalate: true, trigger: "confirmation_no_response", reason: "Sem resposta na confirmação" };
  }

  if (input.lossConfidence === "baixa" && !input.activeBooking) {
    return { escalate: true, trigger: "low_confidence_objection", reason: "Motivo de desistência incerto" };
  }

  if (
    /(enviei|mandei).{0,25}(comprovante|pix|pagamento)/.test(text) ||
    /^(já paguei|ja paguei)\b/.test(text.trim())
  ) {
    return {
      escalate: true,
      trigger: "payment_proof_missing",
      reason: "Paciente indica pagamento enviado — equipe deve validar comprovante",
    };
  }

  return { escalate: false };
}

export type JourneyAiState = {
  journey_step?: string | null;
  contact_intent?: string | null;
  pending_action?: string | null;
  motivo_provavel?: string | null;
  confianca?: "alta" | "media" | "baixa" | null;
  active_appointments?: string[];
  focused_appointment_id?: string | null;
  channel?: string | null;
  captacao_substep?: number | null;
  followup_count?: number;
  confirmation_completed?: ("7d" | "2d" | "day")[];
};

export function mergeJourneyAiState(
  current: JourneyAiState | null | undefined,
  patch: Partial<JourneyAiState>
): JourneyAiState {
  return { ...(current ?? {}), ...patch };
}
