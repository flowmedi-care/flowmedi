import type { JourneyStepCode } from "./types";

export type TimeoutPolicy = {
  step: JourneyStepCode;
  followupHours: number[];
  maxAutoFollowups: number;
  escalateToHuman: boolean;
  archiveAfter?: boolean;
};

export const TIMEOUT_POLICIES: Partial<Record<JourneyStepCode, TimeoutPolicy>> = {
  qualificacao: {
    step: "qualificacao",
    followupHours: [24, 72],
    maxAutoFollowups: 2,
    escalateToHuman: false,
    archiveAfter: true,
  },
  negociacao: {
    step: "negociacao",
    followupHours: [48, 168],
    maxAutoFollowups: 2,
    escalateToHuman: false,
  },
  orcamento_enviado: {
    step: "orcamento_enviado",
    followupHours: [72],
    maxAutoFollowups: 1,
    escalateToHuman: false,
  },
  compliance_2d_enviado: {
    step: "compliance_2d_enviado",
    followupHours: [12, 24],
    maxAutoFollowups: 2,
    escalateToHuman: true,
  },
  sem_resposta_confirmacao: {
    step: "sem_resposta_confirmacao",
    followupHours: [12],
    maxAutoFollowups: 1,
    escalateToHuman: true,
  },
  pagamento_sinal_pendente: {
    step: "pagamento_sinal_pendente",
    followupHours: [24],
    maxAutoFollowups: 1,
    escalateToHuman: true,
  },
  motivo_nao_confirmacao: {
    step: "motivo_nao_confirmacao",
    followupHours: [24, 48],
    maxAutoFollowups: 2,
    escalateToHuman: false,
    archiveAfter: true,
  },
};

export const GLOBAL_MAX_AUTO_FOLLOWUPS = 2;

export function getTimeoutPolicy(step: JourneyStepCode): TimeoutPolicy | null {
  return TIMEOUT_POLICIES[step] ?? null;
}

export function shouldEscalateAfterFollowups(
  step: JourneyStepCode,
  followupCount: number
): boolean {
  const policy = getTimeoutPolicy(step);
  const max = policy?.maxAutoFollowups ?? GLOBAL_MAX_AUTO_FOLLOWUPS;
  if (followupCount >= max) {
    return policy?.escalateToHuman ?? followupCount >= GLOBAL_MAX_AUTO_FOLLOWUPS;
  }
  return false;
}
