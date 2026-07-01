import type { JourneyStepCode } from "./types";

export type StepMetadata = {
  awaitsResponse: boolean;
  maxAutoFollowups: number;
  hint?: string;
  nextStepHint?: string;
};

export const STEP_METADATA: Partial<Record<JourneyStepCode, StepMetadata>> = {
  primeiro_contato: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando nome e necessidade do contato",
    nextStepHint: "Qualificar procedimento e urgência",
  },
  qualificacao: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando procedimento, especialidade ou urgência",
    nextStepHint: "Apresentar informações e valores",
  },
  informacoes_enviadas: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    nextStepHint: "Negociar condições ou fechar agendamento",
  },
  negociacao: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando resposta sobre proposta ou valores",
    nextStepHint: "Confirmar horário e agendar",
  },
  fechamento_agendamento: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando escolha de horário",
    nextStepHint: "Consulta agendada — inicia pré-consulta",
  },
  orcamento_enviado: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando aceite ou recusa do orçamento",
  },
  compliance_2d_enviado: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando confirmação formal (Sim/Não/Remarcar)",
    nextStepHint: "Confirmar presença ou entender motivo",
  },
  sem_resposta_confirmacao: {
    awaitsResponse: true,
    maxAutoFollowups: 1,
    hint: "Sem resposta à confirmação — reforço ou escalonamento",
  },
  motivo_nao_confirmacao: {
    awaitsResponse: true,
    maxAutoFollowups: 2,
    hint: "Aguardando motivo da não confirmação",
  },
  pagamento_sinal_pendente: {
    awaitsResponse: true,
    maxAutoFollowups: 1,
    hint: "Aguardando comprovante de pagamento",
  },
  pesquisa_nps_enviada: {
    awaitsResponse: true,
    maxAutoFollowups: 1,
    hint: "Aguardando nota ou feedback",
  },
  suporte_iniciado: {
    awaitsResponse: true,
    maxAutoFollowups: 1,
    hint: "Aguardando confirmação se a dúvida foi resolvida",
  },
  compliance_7d_enviado: {
    awaitsResponse: false,
    maxAutoFollowups: 0,
    hint: "Lembrete leve enviado — não bloqueante",
  },
  lembrete_dia_enviado: {
    awaitsResponse: false,
    maxAutoFollowups: 0,
    hint: "Lembrete do dia — apenas para confirmados",
  },
};

export function getStepMetadata(code: JourneyStepCode): StepMetadata {
  return (
    STEP_METADATA[code] ?? {
      awaitsResponse: false,
      maxAutoFollowups: 0,
    }
  );
}
