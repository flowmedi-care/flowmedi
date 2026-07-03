import { AGENT_PIPELINE_FLOW_NODES } from "./flow-graph";
import { CRM_TRANSITIONS } from "./flow-model";
import type { UnifiedGraphEdge, UnifiedGraphNode } from "./unified-flow-graph";
import type { AgentPipelineStage } from "./stages";
import type { SwimlaneId } from "./flow-model";

export type PipelineViewTab = "execution" | "journey" | "exits" | "playback";

export type JourneyDisplayMode = "active" | "full";

/** Ordem das 10 etapas para o stepper (main → paralelas → transversal). */
export const PIPELINE_STAGE_STEPPER: {
  code: AgentPipelineStage | "escalonamento";
  shortLabel: string;
}[] = AGENT_PIPELINE_FLOW_NODES.map((n) => ({
  code: n.id,
  shortLabel: n.shortLabel,
}));

const JOURNEY_SWIMLANES: SwimlaneId[] = ["journey", "parallel"];
const EXECUTION_SWIMLANES: SwimlaneId[] = ["execution", "resolver"];
const EXITS_SWIMLANES: SwimlaneId[] = ["exits"];

const PARALLEL_BY_ACTIVE: Partial<Record<AgentPipelineStage, (AgentPipelineStage | "escalonamento")[]>> = {
  identificacao: ["financeiro"],
  captacao: ["financeiro"],
  orcamento: ["financeiro"],
  agendamento: ["financeiro", "formularios"],
  confirmacao_pre_consulta: ["formularios"],
};

export function getJourneyVisibleStageIds(
  mode: JourneyDisplayMode,
  activeStage?: AgentPipelineStage | null,
  parallelStages: AgentPipelineStage[] = []
): Set<AgentPipelineStage | "escalonamento"> {
  if (mode === "full") {
    return new Set(AGENT_PIPELINE_FLOW_NODES.map((n) => n.id));
  }

  const fallback: (AgentPipelineStage | "escalonamento")[] = [
    "identificacao",
    "captacao",
    "orcamento",
    "agendamento",
  ];
  const seed = activeStage ?? fallback[0]!;
  const visible = new Set<AgentPipelineStage | "escalonamento">([seed]);

  for (const t of CRM_TRANSITIONS) {
    if (t.from === seed) visible.add(t.to);
    if (t.to === seed) visible.add(t.from);
  }

  const parallels = PARALLEL_BY_ACTIVE[seed as AgentPipelineStage] ?? [];
  for (const p of parallels) visible.add(p);
  for (const ps of parallelStages) visible.add(ps);

  return visible;
}

function swimlanesForTab(tab: PipelineViewTab): SwimlaneId[] {
  if (tab === "execution" || tab === "playback") return EXECUTION_SWIMLANES;
  if (tab === "journey") return JOURNEY_SWIMLANES;
  return EXITS_SWIMLANES;
}

function nodeVisibleInTab(node: UnifiedGraphNode, tab: PipelineViewTab): boolean {
  if (node.kind === "tool") return false;

  if (node.kind === "swimlane") {
    if (tab === "journey") return false;
    return swimlanesForTab(tab).includes(node.laneId as SwimlaneId);
  }
  if (node.kind === "anchor") {
    if (tab === "exits") return node.id === "anchor_escalation_bus";
    if (tab === "execution" || tab === "playback") return node.id === "anchor_loop_bus";
    return false;
  }
  if (node.id.startsWith("runtime_")) {
    if (tab === "execution" || tab === "playback") {
      return node.laneId !== "exits";
    }
    if (tab === "exits") {
      return (
        node.laneId === "exits" ||
        ["runtime_agent", "runtime_response", "runtime_escalate_gate"].includes(node.id)
      );
    }
    return false;
  }
  if (node.kind === "stage") {
    return tab === "journey" || tab === "exits";
  }
  return false;
}

function edgeVisibleInTab(
  edge: UnifiedGraphEdge,
  tab: PipelineViewTab,
  _journeyMode: JourneyDisplayMode,
  visibleNodeIds: Set<string>
): boolean {
  if (edge.kind === "tool_filter" || edge.kind === "tool_dependency") return false;
  if (edge.id.startsWith("esc-bus-")) return false;

  const dynResolver = ["dyn-switch-stage", "dyn-stage-tools"];
  const resolverParallel = edge.id.startsWith("par-");

  if (tab === "execution" || tab === "playback") {
    if (edge.kind === "stage_transition" || edge.kind === "parallel") return false;
    if (edge.kind === "transversal") return false;
    if (dynResolver.includes(edge.id) || resolverParallel) return false;
    return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
  }

  if (tab === "journey") {
    if (edge.kind !== "stage_transition") return false;
    return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
  }

  if (tab === "exits") {
    if (edge.kind === "stage_transition" || edge.kind === "parallel") return false;
    if (edge.kind === "transversal" || edge.kind === "runtime" || edge.kind === "return") {
      return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
    }
    return false;
  }

  return false;
}

export type FilterGraphOptions = {
  tab: PipelineViewTab;
  journeyMode?: JourneyDisplayMode;
  activeStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
};

export function filterGraphForView(
  nodes: UnifiedGraphNode[],
  edges: UnifiedGraphEdge[],
  opts: FilterGraphOptions
): { nodes: UnifiedGraphNode[]; edges: UnifiedGraphEdge[] } {
  const tab = opts.tab === "playback" ? "execution" : opts.tab;
  const journeyMode = opts.journeyMode ?? "active";

  let visibleStageIds: Set<AgentPipelineStage | "escalonamento"> | null = null;
  if (tab === "journey") {
    visibleStageIds = getJourneyVisibleStageIds(
      journeyMode,
      opts.activeStage,
      opts.parallelStages ?? []
    );
  } else if (tab === "exits") {
    visibleStageIds = new Set(["escalonamento"]);
  }

  const filteredNodes = nodes.filter((n) => {
    if (!nodeVisibleInTab(n, tab)) return false;

    if (tab === "journey" && n.kind === "stage" && n.stageCode && visibleStageIds) {
      return visibleStageIds.has(n.stageCode);
    }
    if (tab === "exits" && n.kind === "stage") {
      return n.stageCode === "escalonamento";
    }

    if (n.kind === "swimlane") {
      const laneWidths: Partial<Record<SwimlaneId, number>> = {
        execution: 2200,
        resolver: 2200,
        journey: 2000,
        parallel: 2000,
        exits: 1600,
      };
      const w = laneWidths[n.laneId as SwimlaneId];
      if (w) {
        return true;
      }
    }

    return true;
  }).map((n) => {
    if (n.kind !== "swimlane") return n;
    const laneWidths: Partial<Record<SwimlaneId, number>> = {
      execution: 2200,
      resolver: 2200,
      journey: 2000,
      parallel: 2000,
      exits: 1600,
    };
    const w = laneWidths[n.laneId as SwimlaneId];
    return w ? { ...n, swimlaneWidth: w } : n;
  });

  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

  const filteredEdges = edges.filter((e) =>
    edgeVisibleInTab(e, tab, journeyMode, visibleNodeIds)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

export function stageNodeId(code: AgentPipelineStage | "escalonamento"): string {
  return `stage_${code}`;
}
