import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";
import type { JourneyStepCode } from "./types";

export type TimeoutAction = "reengage" | "escalate" | "archive" | "transition_pipeline";

export type TimeoutPolicy = {
  step: JourneyStepCode;
  followupHours: number[];
  maxAutoFollowups: number;
  escalateToHuman: boolean;
  archiveAfter?: boolean;
  onExhausted: TimeoutAction;
  pipelineTransition?: AgentPipelineStage;
};

export const TIMEOUT_POLICIES: Partial<Record<JourneyStepCode, TimeoutPolicy>> = {
  qualificacao: {
    step: "qualificacao",
    followupHours: [24, 72],
    maxAutoFollowups: 2,
    escalateToHuman: false,
    archiveAfter: true,
    onExhausted: "archive",
  },
  negociacao: {
    step: "negociacao",
    followupHours: [48, 168],
    maxAutoFollowups: 2,
    escalateToHuman: false,
    onExhausted: "reengage",
  },
  orcamento_enviado: {
    step: "orcamento_enviado",
    followupHours: [72],
    maxAutoFollowups: 1,
    escalateToHuman: false,
    onExhausted: "transition_pipeline",
    pipelineTransition: "captacao",
  },
  formulario_pendente: {
    step: "formulario_pendente",
    followupHours: [48, 96],
    maxAutoFollowups: 2,
    escalateToHuman: true,
    onExhausted: "escalate",
  },
  compliance_2d_enviado: {
    step: "compliance_2d_enviado",
    followupHours: [12, 24],
    maxAutoFollowups: 2,
    escalateToHuman: true,
    onExhausted: "escalate",
  },
  sem_resposta_confirmacao: {
    step: "sem_resposta_confirmacao",
    followupHours: [12],
    maxAutoFollowups: 1,
    escalateToHuman: true,
    onExhausted: "escalate",
  },
  pagamento_sinal_pendente: {
    step: "pagamento_sinal_pendente",
    followupHours: [24],
    maxAutoFollowups: 1,
    escalateToHuman: true,
    onExhausted: "escalate",
  },
  motivo_nao_confirmacao: {
    step: "motivo_nao_confirmacao",
    followupHours: [24, 48],
    maxAutoFollowups: 2,
    escalateToHuman: false,
    archiveAfter: true,
    onExhausted: "archive",
  },
  pesquisa_nps_enviada: {
    step: "pesquisa_nps_enviada",
    followupHours: [24, 72],
    maxAutoFollowups: 2,
    escalateToHuman: false,
    archiveAfter: true,
    onExhausted: "archive",
  },
};

export const GLOBAL_MAX_AUTO_FOLLOWUPS = 2;

export function getTimeoutPolicy(step: JourneyStepCode): TimeoutPolicy | null {
  return TIMEOUT_POLICIES[step] ?? null;
}

export function listTimeoutPolicySteps(): JourneyStepCode[] {
  return Object.keys(TIMEOUT_POLICIES) as JourneyStepCode[];
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

export function getExhaustedAction(step: JourneyStepCode): TimeoutAction {
  const policy = getTimeoutPolicy(step);
  if (!policy) return "reengage";
  if (policy.archiveAfter) return "archive";
  return policy.onExhausted;
}
