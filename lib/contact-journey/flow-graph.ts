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

/** Layout em grade: colunas = fases, ramificações na fase consulta */
export const JOURNEY_FLOW_NODES: FlowNodeDef[] = [
  { code: "primeiro_contato", label: "Primeiro contato", shortLabel: "Contato", phase: "captacao", row: 0, col: 0 },
  { code: "aguardando_retorno", label: "Aguardando retorno", shortLabel: "Retorno", phase: "captacao", row: 1, col: 0 },
  { code: "cadastro_pendente", label: "Cadastro pendente", shortLabel: "Cadastro", phase: "captacao", row: 2, col: 0 },
  { code: "cadastrado", label: "Cadastrado", shortLabel: "Cadastrado", phase: "captacao", row: 3, col: 0 },
  { code: "consulta_agendada", label: "Consulta agendada", shortLabel: "Agendada", phase: "pre_consulta", row: 0, col: 1 },
  { code: "consulta_confirmada", label: "Consulta confirmada", shortLabel: "Confirmada", phase: "pre_consulta", row: 1, col: 1 },
  { code: "formulario_pendente", label: "Formulário pendente", shortLabel: "Formulário", phase: "pre_consulta", row: 2, col: 1 },
  { code: "formulario_ok", label: "Formulário respondido", shortLabel: "Form ok", phase: "pre_consulta", row: 3, col: 1 },
  { code: "consulta_falta", label: "Falta", shortLabel: "Falta", phase: "consulta", row: 0, col: 2 },
  { code: "consulta_realizada", label: "Realizada", shortLabel: "Realizada", phase: "consulta", row: 1, col: 2 },
  { code: "consulta_cancelada", label: "Cancelada", shortLabel: "Cancelada", phase: "consulta", row: 2, col: 2 },
  { code: "retorno_sugerido", label: "Retorno sugerido", shortLabel: "Retorno", phase: "pos_consulta", row: 0, col: 3 },
  { code: "retorno_agendado", label: "Retorno agendado", shortLabel: "Retorno ok", phase: "pos_consulta", row: 1, col: 3 },
  { code: "jornada_concluida", label: "Jornada concluída", shortLabel: "Concluída", phase: "pos_consulta", row: 2, col: 3 },
];

export const JOURNEY_FLOW_EDGES: FlowEdgeDef[] = [
  { from: "primeiro_contato", to: "aguardando_retorno" },
  { from: "aguardando_retorno", to: "cadastro_pendente" },
  { from: "cadastro_pendente", to: "cadastrado" },
  { from: "cadastrado", to: "consulta_agendada" },
  { from: "consulta_agendada", to: "consulta_confirmada" },
  { from: "consulta_confirmada", to: "formulario_pendente" },
  { from: "formulario_pendente", to: "formulario_ok" },
  { from: "consulta_confirmada", to: "consulta_realizada", branch: true },
  { from: "consulta_confirmada", to: "consulta_falta", branch: true },
  { from: "consulta_confirmada", to: "consulta_cancelada", branch: true },
  { from: "formulario_ok", to: "consulta_realizada", branch: true },
  { from: "consulta_agendada", to: "consulta_falta", branch: true },
  { from: "consulta_agendada", to: "consulta_cancelada", branch: true },
  { from: "consulta_realizada", to: "retorno_sugerido" },
  { from: "retorno_sugerido", to: "retorno_agendado" },
  { from: "retorno_agendado", to: "jornada_concluida" },
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

  if (stepOrder > currentOrder) return "upcoming";
  return "alternate";
}
