import type { AgentPipelineStage } from "./stages";
import type { SwimlaneId } from "./flow-model";
import { EXECUTION_NODES } from "./flow-model";

export type EdgeRoutingMode =
  | "direct"
  | "bus-bottom"
  | "bus-top"
  | "bus-escalation"
  | "loop"
  | "vertical-down"
  | "vertical-up"
  | "cross-lane"
  | "switch-fan";

export const LANE_Y: Record<SwimlaneId, { y: number; height: number; label: string }> = {
  execution: { y: 0, height: 140, label: "1 · Execução por mensagem" },
  resolver: { y: 180, height: 200, label: "2 · Switch Resolver" },
  journey: { y: 420, height: 180, label: "3 · Jornada CRM" },
  parallel: { y: 640, height: 120, label: "4 · Paralelas" },
  exits: { y: 800, height: 120, label: "5 · Saídas" },
};

export const LANE_STEP_X = 180;

export const CORRIDORS = {
  loopY: -80,
  betweenLanes: (from: SwimlaneId, to: SwimlaneId) => {
    const fy = LANE_Y[from].y + LANE_Y[from].height;
    const ty = LANE_Y[to].y;
    return (fy + ty) / 2;
  },
  mainBusY: 580,
  escalationY: 860,
  toolColumnOffsetX: 140,
  toolRowGapY: 48,
  switchFanBaseX: 400,
  switchFanGapY: 36,
} as const;

const EXECUTION_ROW_Y = LANE_Y.execution.y + 70;
const JOURNEY_ROW_Y = LANE_Y.journey.y + 90;
const PARALLEL_ROW_Y = LANE_Y.parallel.y + 60;
const EXITS_ROW_Y = LANE_Y.exits.y + 60;
const JOURNEY_STEP_X = 220;

export type NodeLayout = { x: number; y: number; lane: SwimlaneId; width?: number; height?: number };

function executionX(order: number): number {
  return 40 + order * LANE_STEP_X;
}

export const SWIMLANE_BOUNDS = Object.entries(LANE_Y).map(([id, v]) => ({
  id: id as SwimlaneId,
  label: v.label,
  x: 0,
  y: v.y,
  width: 3400,
  height: v.height,
}));

const STAGE_JOURNEY_X: Record<string, number> = {
  stage_identificacao: 40,
  stage_captacao: 40 + JOURNEY_STEP_X,
  stage_orcamento: 40 + JOURNEY_STEP_X * 2,
  stage_agendamento: 40 + JOURNEY_STEP_X * 2.5,
  stage_confirmacao_pre_consulta: 40 + JOURNEY_STEP_X * 3.5,
  stage_pos_consulta: 40 + JOURNEY_STEP_X * 4.5,
  stage_satisfacao: 40 + JOURNEY_STEP_X * 5.5,
  stage_financeiro: 40 + JOURNEY_STEP_X * 2,
  stage_formularios: 40 + JOURNEY_STEP_X * 4,
  stage_escalonamento: 40 + JOURNEY_STEP_X * 6,
};

export function buildNodeLayoutMap(): Record<string, NodeLayout> {
  const map: Record<string, NodeLayout> = {};

  for (const n of EXECUTION_NODES) {
    if (n.lane === "execution") {
      map[n.id] = { x: executionX(n.laneOrder), y: EXECUTION_ROW_Y, lane: "execution" };
    } else if (n.lane === "resolver") {
      map[n.id] = { x: CORRIDORS.switchFanBaseX, y: LANE_Y.resolver.y + 100, lane: "resolver", width: 120, height: 80 };
    } else if (n.lane === "exits") {
      map[n.id] = {
        x: executionX(12) + n.laneOrder * 200,
        y: EXITS_ROW_Y,
        lane: "exits",
      };
    }
  }

  map.anchor_loop_bus = { x: executionX(12) + 80, y: CORRIDORS.loopY, lane: "execution" };
  map.anchor_escalation_bus = { x: 1200, y: CORRIDORS.escalationY, lane: "exits" };

  for (const [id, x] of Object.entries(STAGE_JOURNEY_X)) {
    const lane: SwimlaneId =
      id.includes("financeiro") || id.includes("formularios")
        ? "parallel"
        : id.includes("escalonamento")
          ? "exits"
          : "journey";
    const y =
      lane === "parallel"
        ? PARALLEL_ROW_Y
        : lane === "exits"
          ? EXITS_ROW_Y
          : id.includes("orcamento")
            ? JOURNEY_ROW_Y - 50
            : id.includes("agendamento")
              ? JOURNEY_ROW_Y + 50
              : JOURNEY_ROW_Y;
    map[id] = { x, y, lane };
  }

  return map;
}

export const NODE_LAYOUT = buildNodeLayoutMap();

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
  const l = NODE_LAYOUT[nodeId];
  return l ? { x: l.x, y: l.y } : { x: 0, y: 0 };
}

export function getNodeLane(nodeId: string): SwimlaneId | null {
  return NODE_LAYOUT[nodeId]?.lane ?? null;
}

export function getToolPosition(
  stageKey: string,
  index: number,
  expandedGroupIndex: number
): { x: number; y: number } {
  const stageId = stageKey === "escalonamento" ? "stage_escalonamento" : `stage_${stageKey}`;
  const base = NODE_LAYOUT[stageId] ?? { x: 0, y: JOURNEY_ROW_Y, lane: "journey" as const };
  return {
    x: base.x + CORRIDORS.toolColumnOffsetX,
    y: LANE_Y.parallel.y + LANE_Y.parallel.height + 40 + expandedGroupIndex * 180 + index * CORRIDORS.toolRowGapY,
  };
}

export function deriveEdgeRouting(
  from: string,
  to: string,
  kind: string,
  edgeId?: string
): EdgeRoutingMode {
  if (edgeId === "ex-confirm-agent" || edgeId === "ex-execute-agent" || edgeId?.startsWith("rt-loop")) return "loop";
  if (from === "runtime_resolver_switch" && to.startsWith("stage_")) return "switch-fan";
  if (from === "runtime_resolver_switch" && to === "runtime_tools_hub") return "direct";
  if (to === "anchor_escalation_bus" || from === "anchor_escalation_bus") return "bus-escalation";
  if (from.startsWith("stage_") && to.startsWith("tool_")) return "vertical-down";

  const fl = NODE_LAYOUT[from]?.lane;
  const tl = NODE_LAYOUT[to]?.lane;
  if (fl && tl && fl !== tl) return "cross-lane";

  if (kind === "stage_transition" || kind === "parallel") {
    const fp = NODE_LAYOUT[from];
    const tp = NODE_LAYOUT[to];
    if (!fp || !tp) return "direct";
    const dx = tp.x - fp.x;
    const dy = tp.y - fp.y;
    if (dx < -40 || dx > 350) return "bus-bottom";
    if (dy > 40) return "vertical-down";
    if (dy < -40) return "bus-top";
    return "direct";
  }

  return "direct";
}

export function nodeBelongsToView(
  nodeId: string,
  _lane: SwimlaneId | null,
  viewMode: "full" | "playback" | "stage"
): boolean {
  if (viewMode === "full" || viewMode === "playback") return true;
  if (nodeId.startsWith("anchor_")) return false;
  return nodeId.startsWith("stage_") || nodeId.startsWith("tool_");
}

export function poolForStageCode(code: AgentPipelineStage | "escalonamento"): SwimlaneId {
  if (code === "financeiro" || code === "formularios") return "parallel";
  if (code === "escalonamento") return "exits";
  return "journey";
}

export function getNodeBounds(nodeId: string): { x: number; y: number; w: number; h: number } | null {
  const l = NODE_LAYOUT[nodeId];
  if (!l) return null;
  const w = l.width ?? (nodeId.startsWith("stage_") ? 130 : 100);
  const h = l.height ?? (nodeId.startsWith("stage_") ? 70 : 56);
  return { x: l.x, y: l.y, w, h };
}

export function getSwitchOutputY(index: number): number {
  return LANE_Y.resolver.y + 40 + index * CORRIDORS.switchFanGapY;
}
