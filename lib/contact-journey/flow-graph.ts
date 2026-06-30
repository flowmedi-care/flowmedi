import type { JourneyPhase, JourneyStepCode } from "./types";
import { getStepDefinition } from "./steps";

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

export const JOURNEY_FLOW_NODES: FlowNodeDef[] = [
  { code: "primeiro_contato", label: "Primeiro contato", shortLabel: "Contato", phase: "captacao", row: 0, col: 0 },
  { code: "aguardando_retorno", label: "Aguardando retorno", shortLabel: "Retorno", phase: "captacao", row: 1, col: 0 },
  { code: "cadastro_pendente", label: "Cadastro pendente", shortLabel: "Cadastro", phase: "captacao", row: 2, col: 0 },
  { code: "cadastrado", label: "Cadastrado", shortLabel: "Cadastrado", phase: "captacao", row: 3, col: 0 },
  { code: "orcamento_rascunho", label: "Orç. rascunho", shortLabel: "Rascunho", phase: "comercial", row: 0, col: 1 },
  { code: "orcamento_enviado", label: "Orç. enviado", shortLabel: "Enviado", phase: "comercial", row: 1, col: 1 },
  { code: "orcamento_aceito", label: "Orç. aceito", shortLabel: "Aceito", phase: "comercial", row: 2, col: 1 },
  { code: "orcamento_recusado", label: "Orç. recusado", shortLabel: "Recusado", phase: "comercial", row: 3, col: 1 },
  { code: "consulta_agendada", label: "Consulta agendada", shortLabel: "Agendada", phase: "pre_consulta", row: 0, col: 2 },
  { code: "consulta_confirmada", label: "Consulta confirmada", shortLabel: "Confirmada", phase: "pre_consulta", row: 1, col: 2 },
  { code: "formulario_pendente", label: "Formulário pendente", shortLabel: "Formulário", phase: "pre_consulta", row: 2, col: 2 },
  { code: "formulario_ok", label: "Formulário ok", shortLabel: "Form ok", phase: "pre_consulta", row: 3, col: 2 },
  { code: "checkin_pendente", label: "Check-in", shortLabel: "Check-in", phase: "consulta", row: 0, col: 3 },
  { code: "em_atendimento", label: "Em atendimento", shortLabel: "Atendimento", phase: "consulta", row: 1, col: 3 },
  { code: "consulta_realizada", label: "Realizada", shortLabel: "Realizada", phase: "consulta", row: 2, col: 3 },
  { code: "consulta_falta", label: "Falta", shortLabel: "Falta", phase: "consulta", row: 3, col: 3 },
  { code: "consulta_cancelada", label: "Cancelada", shortLabel: "Cancelada", phase: "consulta", row: 4, col: 3 },
  { code: "pagamento_pendente", label: "Pagamento pendente", shortLabel: "A receber", phase: "financeiro", row: 0, col: 4 },
  { code: "pagamento_parcial", label: "Pagamento parcial", shortLabel: "Parcial", phase: "financeiro", row: 1, col: 4 },
  { code: "pago", label: "Pago", shortLabel: "Pago", phase: "financeiro", row: 2, col: 4 },
  { code: "retorno_sugerido", label: "Retorno sugerido", shortLabel: "Retorno", phase: "pos_consulta", row: 0, col: 5 },
  { code: "retorno_agendado", label: "Retorno agendado", shortLabel: "Retorno ok", phase: "pos_consulta", row: 1, col: 5 },
  { code: "plano_tratamento_ativo", label: "Plano ativo", shortLabel: "Plano", phase: "pos_consulta", row: 2, col: 5 },
  { code: "jornada_concluida", label: "Concluída", shortLabel: "Concluída", phase: "pos_consulta", row: 3, col: 5 },
  { code: "repescagem_ativa", label: "Repescagem", shortLabel: "Repescagem", phase: "reengajamento", row: 0, col: 6 },
];

export const JOURNEY_FLOW_EDGES: FlowEdgeDef[] = [
  { from: "primeiro_contato", to: "aguardando_retorno" },
  { from: "aguardando_retorno", to: "cadastro_pendente" },
  { from: "cadastro_pendente", to: "cadastrado" },
  { from: "cadastrado", to: "orcamento_rascunho", branch: true },
  { from: "cadastrado", to: "consulta_agendada" },
  { from: "orcamento_rascunho", to: "orcamento_enviado" },
  { from: "orcamento_enviado", to: "orcamento_aceito", branch: true },
  { from: "orcamento_enviado", to: "orcamento_recusado", branch: true },
  { from: "orcamento_aceito", to: "consulta_agendada" },
  { from: "orcamento_recusado", to: "repescagem_ativa", branch: true },
  { from: "consulta_agendada", to: "consulta_confirmada" },
  { from: "consulta_confirmada", to: "formulario_pendente" },
  { from: "formulario_pendente", to: "formulario_ok" },
  { from: "consulta_confirmada", to: "checkin_pendente" },
  { from: "formulario_ok", to: "checkin_pendente" },
  { from: "checkin_pendente", to: "em_atendimento" },
  { from: "em_atendimento", to: "consulta_realizada" },
  { from: "consulta_confirmada", to: "consulta_realizada", branch: true },
  { from: "consulta_confirmada", to: "consulta_falta", branch: true },
  { from: "consulta_confirmada", to: "consulta_cancelada", branch: true },
  { from: "consulta_agendada", to: "consulta_falta", branch: true },
  { from: "consulta_agendada", to: "consulta_cancelada", branch: true },
  { from: "consulta_falta", to: "repescagem_ativa", branch: true },
  { from: "consulta_cancelada", to: "repescagem_ativa", branch: true },
  { from: "consulta_realizada", to: "pagamento_pendente", branch: true },
  { from: "pagamento_pendente", to: "pagamento_parcial" },
  { from: "pagamento_parcial", to: "pago" },
  { from: "consulta_realizada", to: "retorno_sugerido" },
  { from: "pago", to: "retorno_sugerido" },
  { from: "retorno_sugerido", to: "retorno_agendado" },
  { from: "retorno_agendado", to: "plano_tratamento_ativo", branch: true },
  { from: "plano_tratamento_ativo", to: "jornada_concluida" },
  { from: "retorno_agendado", to: "jornada_concluida" },
  { from: "repescagem_ativa", to: "aguardando_retorno", branch: true },
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

  const consultaOutcomes: JourneyStepCode[] = [
    "consulta_realizada",
    "consulta_falta",
    "consulta_cancelada",
  ];
  if (
    consultaOutcomes.includes(step) &&
    consultaOutcomes.includes(currentStep) &&
    step !== currentStep
  ) {
    return "alternate";
  }

  const commercialOutcomes: JourneyStepCode[] = [
    "orcamento_aceito",
    "orcamento_recusado",
  ];
  if (
    commercialOutcomes.includes(step) &&
    commercialOutcomes.includes(currentStep) &&
    step !== currentStep
  ) {
    return "alternate";
  }

  if (stepOrder > currentOrder) return "upcoming";
  return "alternate";
}
