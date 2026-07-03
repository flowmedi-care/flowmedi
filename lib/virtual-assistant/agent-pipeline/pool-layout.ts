import type { AgentPipelineStage } from "./stages";

export type PipelinePoolId =
  | "ingress"
  | "execution"
  | "journey_main"
  | "branches"
  | "parallel";

export type EdgeRoutingMode =
  | "direct"
  | "bus-bottom"
  | "bus-top"
  | "bus-escalation"
  | "loop"
  | "vertical-down"
  | "vertical-up";

export type PoolBounds = {
  id: PipelinePoolId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Faixas reservadas — linhas ortogonais passam só aqui */
export const CORRIDORS = {
  loopY: -200,
  mainBusY: 880,
  escalationY: 1180,
  toolColumnOffsetX: 160,
  toolRowGapY: 52,
} as const;

export const POOL_BOUNDS: PoolBounds[] = [
  { id: "ingress", label: "1 · Ingresso", x: 0, y: 0, width: 880, height: 200 },
  { id: "execution", label: "2 · Execução LLM", x: 720, y: -80, width: 2100, height: 460 },
  { id: "journey_main", label: "3 · Jornada CRM (linha principal)", x: 0, y: 480, width: 3100, height: 240 },
  { id: "branches", label: "4 · Ramificações", x: 1040, y: 480, width: 760, height: 400 },
  { id: "parallel", label: "5 · Paralelo + Escalonamento", x: 0, y: 900, width: 3100, height: 420 },
];

const STAGE_MAIN_Y = 580;
const STAGE_STEP_X = 520;

export const NODE_POSITIONS: Record<string, { x: number; y: number; pool: PipelinePoolId }> = {
  // Runtime — pool ingress + execution
  runtime_msg: { x: 40, y: 80, pool: "ingress" },
  runtime_debounce: { x: 280, y: 80, pool: "ingress" },
  runtime_router: { x: 520, y: 80, pool: "ingress" },
  runtime_booking: { x: 860, y: -40, pool: "execution" },
  runtime_agent: { x: 1180, y: 80, pool: "execution" },
  runtime_journey: { x: 1080, y: 300, pool: "execution" },
  runtime_resolver: { x: 1480, y: 300, pool: "execution" },
  runtime_tools_hub: { x: 1880, y: 300, pool: "execution" },
  runtime_confirm_gate: { x: 2280, y: 300, pool: "execution" },
  runtime_response: { x: 2580, y: 80, pool: "execution" },

  // Anchors
  anchor_loop_bus: { x: 2720, y: CORRIDORS.loopY, pool: "execution" },
  anchor_escalation_bus: { x: 1560, y: CORRIDORS.escalationY, pool: "parallel" },

  // CRM main line
  stage_identificacao: { x: 40, y: STAGE_MAIN_Y, pool: "journey_main" },
  stage_captacao: { x: STAGE_STEP_X + 40, y: STAGE_MAIN_Y, pool: "journey_main" },
  stage_confirmacao_pre_consulta: { x: STAGE_STEP_X * 3 + 40, y: STAGE_MAIN_Y, pool: "journey_main" },
  stage_pos_consulta: { x: STAGE_STEP_X * 4 + 40, y: STAGE_MAIN_Y, pool: "journey_main" },
  stage_satisfacao: { x: STAGE_STEP_X * 5 + 40, y: STAGE_MAIN_Y, pool: "journey_main" },

  // Branches
  stage_orcamento: { x: 1120, y: 540, pool: "branches" },
  stage_agendamento: { x: 1420, y: 720, pool: "branches" },

  // Parallel
  stage_financeiro: { x: 1120, y: 960, pool: "parallel" },
  stage_formularios: { x: STAGE_STEP_X * 4 + 40, y: 960, pool: "parallel" },
  stage_escalonamento: { x: STAGE_STEP_X * 5 + 40, y: 960, pool: "parallel" },
};

export const MAIN_STAGE_CODES = [
  "identificacao",
  "captacao",
  "orcamento",
  "agendamento",
  "confirmacao_pre_consulta",
  "pos_consulta",
  "satisfacao",
] as const;

export function getNodePosition(nodeId: string): { x: number; y: number } {
  const pos = NODE_POSITIONS[nodeId];
  if (pos) return { x: pos.x, y: pos.y };
  return { x: 0, y: 0 };
}

export function getNodePool(nodeId: string): PipelinePoolId | null {
  return NODE_POSITIONS[nodeId]?.pool ?? null;
}

/** Posição vertical de tools abaixo da etapa (coluna exclusiva) */
export function getToolPosition(
  stageKey: string,
  index: number,
  expandedGroupIndex: number
): { x: number; y: number } {
  const stageId = stageKey === "escalonamento" ? "stage_escalonamento" : `stage_${stageKey}`;
  const base = NODE_POSITIONS[stageId] ?? { x: 0, y: STAGE_MAIN_Y, pool: "parallel" as const };
  return {
    x: base.x + CORRIDORS.toolColumnOffsetX,
    y: 1040 + expandedGroupIndex * 220 + index * CORRIDORS.toolRowGapY,
  };
}

/** Deriva modo de roteamento ortogonal a partir da aresta CRM */
export function deriveEdgeRouting(
  from: string,
  to: string,
  kind: string,
  edgeId?: string
): EdgeRoutingMode {
  if (edgeId === "rt-confirm-loopbus" || edgeId === "rt-loopbus-agent") return "loop";
  if (edgeId === "rt-router-booking") return "vertical-up";
  if (
    edgeId === "rt-booking-agent" ||
    edgeId === "rt-agent-journey" ||
    edgeId === "rt-journey-resolver" ||
    edgeId === "dyn-resolver-stage"
  ) {
    return "vertical-down";
  }
  if (to === "anchor_escalation_bus" || from === "anchor_escalation_bus") return "bus-escalation";
  if (from.startsWith("stage_") && to.startsWith("tool_")) return "vertical-down";
  if (to === "runtime_tools_hub" && from.startsWith("stage_")) return "bus-top";
  if (from === "runtime_resolver" && to.startsWith("stage_")) return "vertical-down";

  if (kind === "transversal") return "bus-escalation";

  if (kind === "stage_transition" || kind === "parallel") {
    const fp = NODE_POSITIONS[from];
    const tp = NODE_POSITIONS[to];
    if (!fp || !tp) return "direct";
    const dx = tp.x - fp.x;
    const dy = tp.y - fp.y;
    if (dx < -40 || dx > 400) return "bus-bottom";
    if (dy > 50) return "vertical-down";
    if (dy < -50) return "bus-top";
    return "direct";
  }

  return "direct";
}

export function nodeBelongsToView(
  nodeId: string,
  pool: PipelinePoolId | null,
  viewMode: "unified" | "runtime" | "journey"
): boolean {
  if (viewMode === "unified") return true;
  if (nodeId.startsWith("anchor_")) return false;
  if (nodeId.startsWith("pool_")) {
    if (viewMode === "runtime") {
      return nodeId === "pool_ingress" || nodeId === "pool_execution";
    }
    if (viewMode === "journey") {
      return nodeId !== "pool_ingress" && nodeId !== "pool_execution";
    }
  }
  if (nodeId === "runtime_resolver" || nodeId === "runtime_tools_hub") {
    return viewMode === "journey";
  }
  if (nodeId.startsWith("tool_")) return viewMode !== "runtime";
  if (nodeId.startsWith("runtime_")) return viewMode !== "journey";
  if (nodeId.startsWith("stage_")) return viewMode !== "runtime";
  if (pool === "ingress" || pool === "execution") return viewMode !== "journey";
  return viewMode !== "runtime";
}

export function poolForStageCode(code: AgentPipelineStage | "escalonamento"): PipelinePoolId {
  const id = code === "escalonamento" ? "stage_escalonamento" : `stage_${code}`;
  return NODE_POSITIONS[id]?.pool ?? "journey_main";
}
