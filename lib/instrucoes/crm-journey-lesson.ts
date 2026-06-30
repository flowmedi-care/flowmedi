import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS } from "@/lib/leads/lifecycle";
import type { LifecycleStage } from "@/lib/leads/lifecycle";
import type { JourneyStepCode } from "@/lib/contact-journey/types";

export type LessonSection = {
  id: string;
  title: string;
};

export type FunnelStageInfo = {
  stage: LifecycleStage;
  label: string;
  criteria: string;
};

export type ScoreRuleInfo = {
  label: string;
  points: number;
};

export type AppLinkInfo = {
  label: string;
  href: string;
  description: string;
  roles?: string[];
};

export type FlowNodeInfo = {
  code: JourneyStepCode;
  description: string;
  appHref?: string;
  appLabel?: string;
};

export const CRM_JOURNEY_LESSON_SECTIONS: LessonSection[] = [
  { id: "intro", title: "Introdução" },
  { id: "camadas", title: "Três camadas" },
  { id: "funil", title: "Funil CRM" },
  { id: "mapa", title: "Mapa do fluxo" },
  { id: "score", title: "Score e prioridade" },
  { id: "onde-mexer", title: "Onde mexer no app" },
];

export const CRM_JOURNEY_FUNNEL_STAGES: FunnelStageInfo[] = LIFECYCLE_STAGES.map((stage) => {
  const criteria: Record<LifecycleStage, string> = {
    lead_novo: "Entrou (formulário, site, WhatsApp ou manual) e ainda não foi contatado.",
    em_qualificacao: "Equipe registrou contato ou há histórico de interação.",
    qualificado: "Marcado como MQL/SQL, cadastrado como paciente ou com orçamento em andamento.",
    oportunidade: "Consulta agendada/confirmada ou orçamento enviado aguardando resposta.",
    cliente: "Primeira consulta realizada (compareceu).",
    perdido: "Marcado manualmente com motivo (preço, timing, não respondeu, etc.).",
  };
  return {
    stage,
    label: LIFECYCLE_STAGE_LABELS[stage],
    criteria: criteria[stage],
  };
});

export const CRM_JOURNEY_SCORE_RULES: ScoreRuleInfo[] = [
  { label: "Contato nas últimas 24h", points: 25 },
  { label: "Follow-up pendente ou para hoje", points: 20 },
  { label: "Orçamento enviado aguardando resposta", points: 15 },
  { label: "Consulta confirmada em até 3 dias", points: 20 },
  { label: "Formulário pendente antes da consulta", points: 10 },
  { label: "Sem resposta há mais de 7 dias (em qualificação)", points: -30 },
];

export const CRM_JOURNEY_APP_LINKS: AppLinkInfo[] = [
  {
    label: "Centro de Leads",
    href: "/dashboard/contatos/leads",
    description: "Kanban do funil, lista priorizada e score.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Jornada do contato",
    href: "/dashboard/crm/jornada",
    description: "Detalhe operacional de cada pessoa com mapa e próxima ação.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Pipeline CRM",
    href: "/dashboard/crm/pipeline",
    description: "Funis de conversão e comparecimento no tempo.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Orçamentos",
    href: "/dashboard/vendas/orcamentos",
    description: "Propostas comerciais ligadas ao lead ou paciente.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Agenda",
    href: "/dashboard/agenda",
    description: "Agendamento, confirmação e status da consulta.",
  },
];

export const FLOW_NODE_DESCRIPTIONS: Partial<Record<JourneyStepCode, FlowNodeInfo>> = {
  primeiro_contato: {
    code: "primeiro_contato",
    description: "Lead entrou no sistema. Ainda sem contato da equipe.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Centro de Leads",
  },
  aguardando_retorno: {
    code: "aguardando_retorno",
    description: "Equipe já falou; aguarda resposta ou próximo passo.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Centro de Leads",
  },
  cadastrado: {
    code: "cadastrado",
    description: "Lead virou paciente cadastrado na clínica.",
    appHref: "/dashboard/contatos/pacientes",
    appLabel: "Pacientes",
  },
  orcamento_enviado: {
    code: "orcamento_enviado",
    description: "Proposta enviada; aguardando aceite ou recusa.",
    appHref: "/dashboard/vendas/orcamentos",
    appLabel: "Orçamentos",
  },
  consulta_agendada: {
    code: "consulta_agendada",
    description: "Consulta marcada na agenda.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  consulta_realizada: {
    code: "consulta_realizada",
    description: "Paciente compareceu. Marco de conversão em Cliente.",
    appHref: "/dashboard/crm/jornada",
    appLabel: "Jornada",
  },
  pagamento_pendente: {
    code: "pagamento_pendente",
    description: "Cupom emitido ou atendimento finalizado aguardando cobrança.",
    appHref: "/dashboard/financeiro/receber",
    appLabel: "Contas a receber",
  },
  repescagem_ativa: {
    code: "repescagem_ativa",
    description: "Oportunidade de reengajamento após falta, cancelamento ou orçamento recusado.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Repescagem no Centro de Leads",
  },
};

export const CRM_JOURNEY_INTRO = {
  title: "Jornada do lead",
  subtitle: "Como um contato percorre captação, consulta e cobrança — e como priorizar quem atender primeiro.",
  durationMin: 12,
};

export const CRM_JOURNEY_LAYERS = [
  {
    id: "funil",
    title: "Funil CRM",
    description:
      "Uma etapa linear por contato — para kanban, relatórios e visão de gestão. Onde o lead está no funil de vendas.",
    anchor: "funil",
  },
  {
    id: "operacional",
    title: "Jornada operacional",
    description:
      "Detalhe com ramificações — orçamento, formulário, falta, pagamento. Explica o que está acontecendo agora.",
    anchor: "mapa",
  },
  {
    id: "score",
    title: "Score híbrido",
    description:
      "Priorização automática (0–100) com temperatura frio/morno/quente. A equipe pode ajustar manualmente.",
    anchor: "score",
  },
] as const;
