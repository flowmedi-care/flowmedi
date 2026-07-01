import type { JourneyPhase, JourneyStepCode } from "./types";
import { getStepDefinition, JOURNEY_STEPS } from "./steps";

export type FlowNodeDef = {
  code: JourneyStepCode;
  label: string;
  shortLabel: string;
  phase: JourneyPhase;
  row: number;
  col: number;
};

export type FlowEdgeDef = {
  from: JourneyStepCode;
  to: JourneyStepCode;
  branch?: boolean;
};

const PHASE_COL_INDEX: Record<JourneyPhase, number> = {
  captacao: 0,
  comercial: 1,
  pre_consulta: 2,
  consulta: 3,
  financeiro: 4,
  pos_consulta: 5,
  pos_atendimento: 6,
  reengajamento: 7,
};

function node(
  code: JourneyStepCode,
  row: number,
  phase?: JourneyPhase
): FlowNodeDef {
  const def = JOURNEY_STEPS.find((s) => s.code === code) ?? JOURNEY_STEPS[0];
  const p = phase ?? def.phase;
  return {
    code,
    label: def.label,
    shortLabel: def.shortLabel,
    phase: p,
    row,
    col: PHASE_COL_INDEX[p],
  };
}

export const JOURNEY_FLOW_NODES: FlowNodeDef[] = [
  node("origem_identificada", 0),
  node("primeiro_contato", 1),
  node("qualificacao", 2),
  node("informacoes_enviadas", 3),
  node("negociacao", 4),
  node("fechamento_agendamento", 5),
  node("objecao_identificada", 6),
  node("suporte_iniciado", 7),
  node("suporte_concluido", 8),
  node("orcamento_rascunho", 0, "comercial"),
  node("orcamento_enviado", 1, "comercial"),
  node("orcamento_aceito", 2, "comercial"),
  node("orcamento_recusado", 3, "comercial"),
  node("orcamento_vencido", 4, "comercial"),
  node("pagamento_sinal_pendente", 5, "comercial"),
  node("comprovante_recebido", 6, "comercial"),
  node("consulta_agendada", 0, "pre_consulta"),
  node("agradecimento_agendamento", 1, "pre_consulta"),
  node("compliance_7d_enviado", 2, "pre_consulta"),
  node("compliance_2d_enviado", 3, "pre_consulta"),
  node("consulta_confirmada", 4, "pre_consulta"),
  node("lembrete_dia_enviado", 5, "pre_consulta"),
  node("sem_resposta_confirmacao", 6, "pre_consulta"),
  node("motivo_nao_confirmacao", 7, "pre_consulta"),
  node("formulario_pendente", 8, "pre_consulta"),
  node("checkin_pendente", 0, "consulta"),
  node("em_atendimento", 1, "consulta"),
  node("consulta_realizada", 2, "consulta"),
  node("consulta_falta", 3, "consulta"),
  node("consulta_cancelada", 4, "consulta"),
  node("pagamento_pendente", 0, "financeiro"),
  node("pagamento_parcial", 1, "financeiro"),
  node("pago", 2, "financeiro"),
  node("retorno_sugerido", 0, "pos_consulta"),
  node("retorno_agendado", 1, "pos_consulta"),
  node("plano_tratamento_ativo", 2, "pos_consulta"),
  node("jornada_concluida", 3, "pos_consulta"),
  node("pesquisa_nps_enviada", 0, "pos_atendimento"),
  node("feedback_recebido", 1, "pos_atendimento"),
  node("repescagem_ativa", 0, "reengajamento"),
  node("reativacao_iniciada", 1, "reengajamento"),
];

export const JOURNEY_FLOW_EDGES: FlowEdgeDef[] = [
  { from: "origem_identificada", to: "primeiro_contato" },
  { from: "primeiro_contato", to: "qualificacao" },
  { from: "qualificacao", to: "informacoes_enviadas" },
  { from: "informacoes_enviadas", to: "negociacao" },
  { from: "negociacao", to: "fechamento_agendamento" },
  { from: "qualificacao", to: "fechamento_agendamento", branch: true },
  { from: "negociacao", to: "objecao_identificada", branch: true },
  { from: "objecao_identificada", to: "repescagem_ativa", branch: true },
  { from: "fechamento_agendamento", to: "consulta_agendada" },
  { from: "primeiro_contato", to: "suporte_iniciado", branch: true },
  { from: "suporte_iniciado", to: "suporte_concluido" },
  { from: "suporte_iniciado", to: "reclamacao_escalada", branch: true },
  { from: "suporte_concluido", to: "qualificacao", branch: true },
  { from: "cadastrado", to: "orcamento_rascunho", branch: true },
  { from: "orcamento_rascunho", to: "orcamento_enviado" },
  { from: "orcamento_enviado", to: "orcamento_aceito", branch: true },
  { from: "orcamento_enviado", to: "orcamento_recusado", branch: true },
  { from: "orcamento_enviado", to: "orcamento_vencido", branch: true },
  { from: "orcamento_aceito", to: "pagamento_sinal_pendente", branch: true },
  { from: "pagamento_sinal_pendente", to: "comprovante_recebido" },
  { from: "orcamento_aceito", to: "fechamento_agendamento" },
  { from: "orcamento_recusado", to: "repescagem_ativa", branch: true },
  { from: "consulta_agendada", to: "agradecimento_agendamento" },
  { from: "agradecimento_agendamento", to: "compliance_7d_enviado" },
  { from: "compliance_7d_enviado", to: "compliance_2d_enviado" },
  { from: "compliance_2d_enviado", to: "consulta_confirmada", branch: true },
  { from: "compliance_2d_enviado", to: "sem_resposta_confirmacao", branch: true },
  { from: "compliance_2d_enviado", to: "motivo_nao_confirmacao", branch: true },
  { from: "sem_resposta_confirmacao", to: "motivo_nao_confirmacao", branch: true },
  { from: "consulta_confirmada", to: "lembrete_dia_enviado" },
  { from: "consulta_confirmada", to: "formulario_pendente" },
  { from: "formulario_pendente", to: "formulario_ok" },
  { from: "consulta_confirmada", to: "checkin_pendente" },
  { from: "formulario_ok", to: "checkin_pendente" },
  { from: "consulta_agendada", to: "consulta_cancelada", branch: true },
  { from: "consulta_confirmada", to: "consulta_cancelada", branch: true },
  { from: "consulta_agendada", to: "reagendamento_confirmado", branch: true },
  { from: "consulta_confirmada", to: "reagendamento_confirmado", branch: true },
  { from: "reagendamento_confirmado", to: "consulta_agendada" },
  { from: "motivo_nao_confirmacao", to: "reagendamento_confirmado", branch: true },
  { from: "motivo_nao_confirmacao", to: "consulta_cancelada", branch: true },
  { from: "checkin_pendente", to: "em_atendimento" },
  { from: "em_atendimento", to: "consulta_realizada" },
  { from: "consulta_confirmada", to: "consulta_falta", branch: true },
  { from: "consulta_falta", to: "repescagem_ativa", branch: true },
  { from: "consulta_cancelada", to: "repescagem_ativa", branch: true },
  { from: "consulta_realizada", to: "pagamento_pendente", branch: true },
  { from: "pagamento_pendente", to: "pagamento_parcial" },
  { from: "pagamento_parcial", to: "pago" },
  { from: "consulta_realizada", to: "retorno_sugerido" },
  { from: "consulta_realizada", to: "pesquisa_nps_enviada", branch: true },
  { from: "pesquisa_nps_enviada", to: "feedback_recebido" },
  { from: "pago", to: "retorno_sugerido" },
  { from: "retorno_sugerido", to: "retorno_agendado" },
  { from: "retorno_agendado", to: "consulta_agendada" },
  { from: "repescagem_ativa", to: "reativacao_iniciada", branch: true },
  { from: "reativacao_iniciada", to: "qualificacao" },
];

const NODE_BY_CODE = new Map(JOURNEY_FLOW_NODES.map((n) => [n.code, n]));

export function getFlowNode(code: JourneyStepCode): FlowNodeDef {
  return NODE_BY_CODE.get(code) ?? JOURNEY_FLOW_NODES[0];
}

export function getActivePathEdges(
  currentStep: JourneyStepCode,
  completedSteps: JourneyStepCode[]
): Set<string> {
  const visited = new Set<JourneyStepCode>([...completedSteps, currentStep]);
  const active = new Set<string>();

  for (const edge of JOURNEY_FLOW_EDGES) {
    if (visited.has(edge.from) && visited.has(edge.to)) {
      active.add(`${edge.from}->${edge.to}`);
    }
  }

  const currentOrder = getStepDefinition(currentStep).order;
  for (const step of visited) {
    if (getStepDefinition(step).order < currentOrder) {
      const parent = JOURNEY_FLOW_EDGES.find((e) => e.to === step && visited.has(e.from));
      if (parent) active.add(`${parent.from}->${parent.to}`);
    }
  }

  return active;
}

const ALTERNATE_GROUPS: JourneyStepCode[][] = [
  ["consulta_realizada", "consulta_falta", "consulta_cancelada"],
  ["orcamento_aceito", "orcamento_recusado", "orcamento_vencido"],
  ["consulta_confirmada", "sem_resposta_confirmacao", "motivo_nao_confirmacao"],
];

export function isOnActiveBranch(
  step: JourneyStepCode,
  currentStep: JourneyStepCode,
  completedSteps: JourneyStepCode[]
): "current" | "completed" | "upcoming" | "alternate" {
  if (step === currentStep) return "current";
  const completedSet = new Set(completedSteps);
  const currentOrder = getStepDefinition(currentStep).order;
  const stepOrder = getStepDefinition(step).order;

  if (completedSet.has(step) || stepOrder < currentOrder) return "completed";

  for (const group of ALTERNATE_GROUPS) {
    if (group.includes(step) && group.includes(currentStep) && step !== currentStep) {
      return "alternate";
    }
  }

  if (stepOrder > currentOrder) return "upcoming";
  return "alternate";
}

export const FLOW_PHASE_COLS: { phase: JourneyPhase; col: number }[] = (
  Object.entries(PHASE_COL_INDEX) as [JourneyPhase, number][]
).map(([phase, col]) => ({ phase, col }));
