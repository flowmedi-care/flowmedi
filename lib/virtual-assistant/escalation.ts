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
};

const COMPLAINT = [/reclamação/i, /reclamacao/i, /procon/i, /advogado/i, /processo/i];
const HUMAN = [/atendente/i, /humano/i, /falar com (uma )?pessoa/i];

export function shouldEscalateToHuman(input: EscalationInput): {
  escalate: boolean;
  trigger?: EscalationTrigger;
  reason?: string;
} {
  const text = input.messageText ?? "";

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

  if (input.lossConfidence === "baixa") {
    return { escalate: true, trigger: "low_confidence_objection", reason: "Motivo de desistência incerto" };
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
