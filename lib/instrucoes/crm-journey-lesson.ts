import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS } from "@/lib/leads/lifecycle";
import type { LifecycleStage } from "@/lib/leads/lifecycle";
import type { JourneyPhase, JourneyStepCode } from "@/lib/contact-journey/types";
import { JOURNEY_FLOW_NODES } from "@/lib/contact-journey/flow-graph";

export type LessonSection = {
  id: string;
  title: string;
};

export type FunnelStageInfo = {
  stage: LifecycleStage;
  label: string;
  criteria: string;
  example?: string;
};

export type ScoreRuleInfo = {
  label: string;
  points: number;
  plainText: string;
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
  whatToDo?: string;
  appHref?: string;
  appLabel?: string;
};

export type PhaseIntro = {
  phase: JourneyPhase;
  title: string;
  description: string;
};

export type StoryStep = {
  step: number;
  title: string;
  body: string;
};

export const CRM_JOURNEY_LESSON_SECTIONS: LessonSection[] = [
  { id: "intro", title: "Começo" },
  { id: "camadas", title: "Três visões" },
  { id: "funil", title: "O funil simples" },
  { id: "historia", title: "Passo a passo" },
  { id: "mapa", title: "Mapa interativo" },
  { id: "score", title: "Quem atender primeiro" },
  { id: "onde-mexer", title: "Onde fazer no app" },
];

export const CRM_JOURNEY_FUNNEL_STAGES: FunnelStageInfo[] = LIFECYCLE_STAGES.map((stage) => {
  const criteria: Record<LifecycleStage, { when: string; example: string }> = {
    lead_novo: {
      when: "A pessoa entrou em contato (site, WhatsApp, indicação) e a clínica ainda não falou com ela.",
      example: "Maria preencheu o formulário do site ontem à noite.",
    },
    em_qualificacao: {
      when: "Alguém da equipe já entrou em contato — por telefone, WhatsApp ou outro canal.",
      example: "A secretária mandou mensagem e está esperando a Maria responder.",
    },
    qualificado: {
      when: "A pessoa demonstrou interesse real: virou paciente cadastrado ou está com orçamento em andamento.",
      example: "Maria disse que quer marcar consulta ou pediu um orçamento de procedimento.",
    },
    oportunidade: {
      when: "Tem consulta marcada (ou confirmada) ou um orçamento enviado aguardando resposta.",
      example: "Consulta na terça às 14h ou orçamento de R$ 2.000 enviado por e-mail.",
    },
    cliente: {
      when: "A pessoa compareceu e realizou a primeira consulta.",
      example: "Maria veio na clínica e foi atendida — agora é paciente de fato.",
    },
    perdido: {
      when: "A equipe marcou que não vai seguir — com um motivo registrado.",
      example: "Não respondeu, achou caro ou desistiu por enquanto.",
    },
  };
  return {
    stage,
    label: LIFECYCLE_STAGE_LABELS[stage],
    criteria: criteria[stage].when,
    example: criteria[stage].example,
  };
});

export const CRM_JOURNEY_STORY: StoryStep[] = [
  {
    step: 1,
    title: "Alguém aparece",
    body: "Pode ser pelo site, WhatsApp, indicação ou cadastro manual. Essa pessoa ainda é um lead — alguém que demonstrou interesse, mas ainda não é paciente.",
  },
  {
    step: 2,
    title: "A equipe entra em contato",
    body: "A secretária ou recepção responde, tira dúvidas e entende o que a pessoa precisa. A partir daqui começa o acompanhamento no sistema.",
  },
  {
    step: 3,
    title: "Dois caminhos comuns",
    body: "Dependendo do caso, a pessoa pode ir direto para uma consulta ou passar por um orçamento antes (procedimentos estéticos, cirurgias, pacotes). Os dois caminhos são normais.",
  },
  {
    step: 4,
    title: "Antes da consulta",
    body: "Com a consulta marcada, a clínica confirma o horário, pode pedir formulários e prepara o check-in no dia.",
  },
  {
    step: 5,
    title: "No dia da consulta",
    body: "A pessoa pode comparecer, faltar ou cancelar. Se comparecer, vira cliente. Se faltar ou cancelar, entra em repescagem — uma nova chance de reagendar.",
  },
  {
    step: 6,
    title: "Depois da consulta",
    body: "Pode haver cobrança pendente, sugestão de retorno ou um plano de tratamento. Quando tudo está resolvido, a jornada daquele atendimento se encerra.",
  },
];

export const CRM_JOURNEY_PHASE_INTROS: PhaseIntro[] = [
  {
    phase: "captacao",
    title: "Primeiro contato",
    description: "De onde veio o lead e se a equipe já respondeu.",
  },
  {
    phase: "comercial",
    title: "Orçamento",
    description: "Quando a venda passa por proposta de valor antes da consulta.",
  },
  {
    phase: "pre_consulta",
    title: "Preparação",
    description: "Agendamento, confirmação e formulários antes do dia.",
  },
  {
    phase: "consulta",
    title: "Dia da consulta",
    description: "Check-in, atendimento, falta ou cancelamento.",
  },
  {
    phase: "financeiro",
    title: "Pagamento",
    description: "O que ficou a receber depois do atendimento.",
  },
  {
    phase: "pos_consulta",
    title: "Depois da consulta",
    description: "Retorno, plano de tratamento e encerramento.",
  },
  {
    phase: "reengajamento",
    title: "Nova chance",
    description: "Quem sumiu, faltou ou recusou orçamento — tentar de novo.",
  },
];

export const CRM_JOURNEY_SCORE_RULES: ScoreRuleInfo[] = [
  {
    label: "Contato nas últimas 24h",
    points: 25,
    plainText: "Você falou com essa pessoa recentemente — vale manter o ritmo.",
  },
  {
    label: "Follow-up pendente ou para hoje",
    points: 20,
    plainText: "Tem uma tarefa marcada para retornar — não deixe passar.",
  },
  {
    label: "Orçamento enviado aguardando resposta",
    points: 15,
    plainText: "A pessoa recebeu proposta e pode estar decidindo agora.",
  },
  {
    label: "Consulta confirmada em até 3 dias",
    points: 20,
    plainText: "Consulta chegando — confirme e prepare tudo.",
  },
  {
    label: "Formulário pendente antes da consulta",
    points: 10,
    plainText: "Falta documento ou formulário — cobre antes do dia.",
  },
  {
    label: "Sem resposta há mais de 7 dias (em qualificação)",
    points: -30,
    plainText: "Muito tempo sem retorno — prioridade cai, mas ainda pode repescar.",
  },
];

export const CRM_JOURNEY_APP_LINKS: AppLinkInfo[] = [
  {
    label: "Centro de Leads",
    href: "/dashboard/contatos/leads",
    description: "Veja todos os leads, em qual etapa estão e quem precisa de atenção hoje.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Jornada do contato",
    href: "/dashboard/crm/jornada",
    description: "Abra uma pessoa específica e veja exatamente em que passo ela está.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Pipeline CRM",
    href: "/dashboard/crm/pipeline",
    description: "Relatórios: quantos viram cliente, quantos faltaram, conversão no tempo.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Orçamentos",
    href: "/dashboard/vendas/orcamentos",
    description: "Crie e acompanhe propostas comerciais.",
    roles: ["admin", "secretaria"],
  },
  {
    label: "Agenda",
    href: "/dashboard/agenda",
    description: "Marque, confirme e registre o comparecimento das consultas.",
  },
];

const NODE_COPY: Record<JourneyStepCode, Omit<FlowNodeInfo, "code">> = {
  primeiro_contato: {
    description: "A pessoa acabou de chegar — formulário, WhatsApp ou indicação.",
    whatToDo: "Entre em contato o quanto antes.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Ver leads novos",
  },
  aguardando_retorno: {
    description: "Você já falou com ela e está esperando uma resposta.",
    whatToDo: "Faça um follow-up se passar do prazo combinado.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Centro de Leads",
  },
  cadastro_pendente: {
    description: "Falta completar o cadastro da pessoa como paciente.",
    whatToDo: "Peça os dados que faltam e finalize o cadastro.",
    appHref: "/dashboard/contatos/pacientes",
    appLabel: "Pacientes",
  },
  cadastrado: {
    description: "A pessoa já está cadastrada na clínica.",
    whatToDo: "Agende consulta ou monte um orçamento, conforme o caso.",
    appHref: "/dashboard/contatos/pacientes",
    appLabel: "Pacientes",
  },
  orcamento_rascunho: {
    description: "Orçamento começado, mas ainda não enviado.",
    whatToDo: "Finalize os valores e envie para o lead.",
    appHref: "/dashboard/vendas/orcamentos",
    appLabel: "Orçamentos",
  },
  orcamento_enviado: {
    description: "Proposta enviada — a pessoa está decidindo.",
    whatToDo: "Acompanhe e retorne em alguns dias se não houver resposta.",
    appHref: "/dashboard/vendas/orcamentos",
    appLabel: "Orçamentos",
  },
  orcamento_aceito: {
    description: "A pessoa aceitou o orçamento.",
    whatToDo: "Agende a consulta ou procedimento combinado.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  orcamento_recusado: {
    description: "A pessoa recusou o orçamento.",
    whatToDo: "Registre o motivo e considere repescagem no futuro.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Centro de Leads",
  },
  consulta_agendada: {
    description: "Consulta marcada, mas ainda não confirmada.",
    whatToDo: "Confirme data e horário com o paciente.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  consulta_confirmada: {
    description: "Paciente confirmou que virá.",
    whatToDo: "Envie lembretes e prepare formulários se necessário.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  formulario_pendente: {
    description: "Falta preencher formulário antes da consulta.",
    whatToDo: "Envie o link e cobre o preenchimento.",
    appHref: "/dashboard/formularios",
    appLabel: "Formulários",
  },
  formulario_ok: {
    description: "Formulários em dia.",
    whatToDo: "Siga para o check-in no dia da consulta.",
  },
  checkin_pendente: {
    description: "É o dia da consulta — aguardando chegada.",
    whatToDo: "Faça o check-in quando a pessoa chegar.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  em_atendimento: {
    description: "Paciente está sendo atendido agora.",
    whatToDo: "Finalize o atendimento no prontuário.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  consulta_realizada: {
    description: "Consulta concluída — a pessoa compareceu.",
    whatToDo: "Ela vira cliente. Emita cobrança se houver e sugira retorno.",
    appHref: "/dashboard/crm/jornada",
    appLabel: "Jornada",
  },
  consulta_falta: {
    description: "Paciente não compareceu.",
    whatToDo: "Entre em contato e tente reagendar (repescagem).",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  consulta_cancelada: {
    description: "Consulta foi cancelada.",
    whatToDo: "Entenda o motivo e ofereça novo horário se fizer sentido.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  pagamento_pendente: {
    description: "Atendimento feito, mas ainda há valor a receber.",
    whatToDo: "Cobre ou registre o pagamento.",
    appHref: "/dashboard/financeiro/receber",
    appLabel: "Contas a receber",
  },
  pagamento_parcial: {
    description: "Parte do valor já foi paga.",
    whatToDo: "Acompanhe o saldo restante.",
    appHref: "/dashboard/financeiro/receber",
    appLabel: "Contas a receber",
  },
  pago: {
    description: "Tudo quitado para este atendimento.",
    whatToDo: "Sugira retorno ou plano de tratamento se aplicável.",
    appHref: "/dashboard/financeiro/receber",
    appLabel: "Contas a receber",
  },
  retorno_sugerido: {
    description: "Médico sugeriu retorno.",
    whatToDo: "Ofereça agendamento do retorno.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  retorno_agendado: {
    description: "Retorno já está marcado.",
    whatToDo: "Confirme como uma consulta normal.",
    appHref: "/dashboard/agenda",
    appLabel: "Agenda",
  },
  plano_tratamento_ativo: {
    description: "Paciente em plano de tratamento contínuo.",
    whatToDo: "Acompanhe sessões e evolução.",
    appHref: "/dashboard/planos-tratamento",
    appLabel: "Planos de tratamento",
  },
  jornada_concluida: {
    description: "Este ciclo de atendimento terminou.",
    whatToDo: "Nada pendente por aqui — até a próxima demanda.",
    appHref: "/dashboard/crm/jornada",
    appLabel: "Jornada",
  },
  repescagem_ativa: {
    description: "Segunda chance: quem faltou, cancelou ou recusou orçamento.",
    whatToDo: "Retome o contato com empatia e ofereça nova oportunidade.",
    appHref: "/dashboard/contatos/leads",
    appLabel: "Centro de Leads",
  },
};

export const FLOW_NODE_DESCRIPTIONS: Record<JourneyStepCode, FlowNodeInfo> =
  Object.fromEntries(
    JOURNEY_FLOW_NODES.map((node) => [
      node.code,
      { code: node.code, ...NODE_COPY[node.code] },
    ])
  ) as Record<JourneyStepCode, FlowNodeInfo>;

export const CRM_JOURNEY_INTRO = {
  title: "Jornada do lead",
  subtitle:
    "Entenda, de forma simples, o caminho de quem entra em contato com a clínica — do primeiro oi até virar paciente (ou ser repescado).",
  durationMin: 12,
};

export const CRM_JOURNEY_LAYERS = [
  {
    id: "funil",
    title: "O funil — visão geral",
    description:
      "Como um placar com 6 colunas: mostra em que “fase grande” cada pessoa está. Bom para gestão e relatórios.",
    anchor: "funil",
    analogy: "Pense num quadro na parede com colunas: Novo → Em conversa → Interessado → Quase fechando → Cliente → Desistiu.",
  },
  {
    id: "operacional",
    title: "O dia a dia — detalhes",
    description:
      "O que está acontecendo agora com aquela pessoa: orçamento, formulário, falta, pagamento…",
    anchor: "mapa",
    analogy: "É o GPS do atendimento: mostra o passo exato, inclusive desvios (falta, orçamento recusado).",
  },
  {
    id: "score",
    title: "Quem atender primeiro",
    description:
      "Uma nota de 0 a 100 que ajuda a secretária a saber quem precisa de retorno urgente.",
    anchor: "score",
    analogy: "Como um semáforo: vermelho (frio), amarelo (morno), verde (quente) — você pode ajustar manualmente.",
  },
] as const;
