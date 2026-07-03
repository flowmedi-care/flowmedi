import { ASSISTANT_TOOL_CATALOG } from "../tools/catalog";
import { MUTATING_TOOL_NAMES } from "./constants";
import {
  CRM_TRANSITIONS,
  EXECUTION_EDGES,
  EXECUTION_NODES,
  PARALLEL_ACTIVATION_RULES,
  RESOLVER_SWITCH_RULES,
} from "./flow-model";
import { AGENT_PIPELINE_FLOW_EDGES, AGENT_PIPELINE_FLOW_NODES } from "./flow-graph";
import { AGENT_PIPELINE_STAGES, type AgentPipelineStage } from "./stages";
import {
  deriveEdgeRouting,
  getNodeLane,
  getNodePosition,
  getToolPosition,
  MAIN_STAGE_CODES,
  SWIMLANE_BOUNDS,
} from "./swimlane-layout";
import type { EdgeRoutingMode } from "./swimlane-layout";

export type UnifiedNodeKind =
  | "runtime"
  | "stage"
  | "tool"
  | "hub"
  | "anchor"
  | "swimlane"
  | "switch"
  | "gate";

export type UnifiedEdgeKind =
  | "runtime"
  | "context"
  | "stage_transition"
  | "tool_filter"
  | "tool_dependency"
  | "parallel"
  | "transversal"
  | "return";

export type UnifiedGraphNode = {
  id: string;
  kind: UnifiedNodeKind;
  label: string;
  shortLabel?: string;
  description?: string;
  position: { x: number; y: number };
  stageCode?: AgentPipelineStage | "escalonamento";
  toolName?: string;
  toolCategory?: string;
  mutating?: boolean;
  crmPhase?: string;
  runtimeIcon?: string;
  laneId?: string;
  swimlaneWidth?: number;
  swimlaneHeight?: number;
  switchRules?: typeof RESOLVER_SWITCH_RULES;
};

export type UnifiedGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: UnifiedEdgeKind;
  label?: string;
  routing?: EdgeRoutingMode;
  triggerType?: string;
};

const mutatingSet = new Set<string>(MUTATING_TOOL_NAMES);

export const EXTRA_TOOL_DEPENDENCIES: { from: string; to: string }[] = [
  { from: "list_patient_appointments", to: "confirm_appointment" },
  { from: "list_patient_appointments", to: "cancel_appointment" },
  { from: "list_patient_appointments", to: "reschedule_appointment" },
];

export function getToolPrimaryStage(toolName: string): AgentPipelineStage | "escalonamento" | null {
  if (toolName === "transfer_to_human") return "escalonamento";
  for (const stage of AGENT_PIPELINE_STAGES) {
    if (stage.readTools.includes(toolName) || stage.mutatingTools.includes(toolName)) {
      return stage.code;
    }
  }
  return null;
}

function withRouting(edge: Omit<UnifiedGraphEdge, "routing">): UnifiedGraphEdge {
  return { ...edge, routing: deriveEdgeRouting(edge.from, edge.to, edge.kind, edge.id) };
}

export function buildSwimlaneNodes(): UnifiedGraphNode[] {
  return SWIMLANE_BOUNDS.map((s) => ({
    id: `swimlane_${s.id}`,
    kind: "swimlane" as const,
    label: s.label,
    position: { x: s.x, y: s.y },
    laneId: s.id,
    swimlaneWidth: s.width,
    swimlaneHeight: s.height,
  }));
}

export function buildExecutionNodes(): UnifiedGraphNode[] {
  return EXECUTION_NODES.map((n) => ({
    id: n.id,
    kind: (n.nodeKind ?? "runtime") as UnifiedNodeKind,
    label: n.label,
    shortLabel: n.shortLabel,
    description: n.description,
    position: getNodePosition(n.id),
    runtimeIcon: n.runtimeIcon,
    laneId: n.lane,
    switchRules: n.nodeKind === "switch" ? RESOLVER_SWITCH_RULES : undefined,
  }));
}

export const ROUTE_ANCHOR_NODES: UnifiedGraphNode[] = [
  { id: "anchor_loop_bus", kind: "anchor", label: "", position: getNodePosition("anchor_loop_bus") },
  { id: "anchor_escalation_bus", kind: "anchor", label: "", position: getNodePosition("anchor_escalation_bus") },
];

export function buildStageNodes(): UnifiedGraphNode[] {
  return AGENT_PIPELINE_FLOW_NODES.map((n) => ({
    id: `stage_${n.id}`,
    kind: "stage" as const,
    label: n.label,
    shortLabel: n.shortLabel,
    stageCode: n.id,
    crmPhase: n.crmPhase,
    position: getNodePosition(`stage_${n.id}`),
    laneId: getNodeLane(`stage_${n.id}`) ?? undefined,
  }));
}

export function buildToolNodes(expandedStages: Set<string>): UnifiedGraphNode[] {
  const nodes: UnifiedGraphNode[] = [];
  const toolsByStage = new Map<string, string[]>();

  for (const entry of ASSISTANT_TOOL_CATALOG) {
    const stage = getToolPrimaryStage(entry.name);
    if (!stage) continue;
    const key = stage === "escalonamento" ? "escalonamento" : stage;
    if (!toolsByStage.has(key)) toolsByStage.set(key, []);
    toolsByStage.get(key)!.push(entry.name);
  }

  let expandedIndex = 0;
  for (const [stageKey, toolNames] of toolsByStage) {
    if (!expandedStages.has(stageKey)) continue;
    toolNames.forEach((toolName, i) => {
      const entry = ASSISTANT_TOOL_CATALOG.find((t) => t.name === toolName)!;
      nodes.push({
        id: `tool_${toolName}`,
        kind: "tool",
        label: entry.label,
        shortLabel: entry.label,
        toolName,
        toolCategory: entry.category,
        mutating: mutatingSet.has(toolName),
        position: getToolPosition(stageKey, i, expandedIndex),
        stageCode: stageKey === "escalonamento" ? "escalonamento" : (stageKey as AgentPipelineStage),
        laneId: "parallel",
      });
    });
    expandedIndex++;
  }
  return nodes;
}

export function buildExecutionEdges(): UnifiedGraphEdge[] {
  return EXECUTION_EDGES.map((e) =>
    withRouting({
      id: e.id,
      from: e.from,
      to: e.to,
      kind: e.kind,
      label: e.label ?? e.trigger?.label,
      triggerType: e.trigger?.type,
    })
  );
}

export function buildSwitchToStageEdges(activeStage?: AgentPipelineStage | null): UnifiedGraphEdge[] {
  if (!activeStage) return [];
  return [
    withRouting({
      id: "dyn-switch-stage",
      from: "runtime_resolver_switch",
      to: `stage_${activeStage}`,
      kind: "context",
      label: RESOLVER_SWITCH_RULES.find((r) => r.targetStage === activeStage)?.label ?? "etapa ativa",
      triggerType: "resolver",
    }),
    withRouting({
      id: "dyn-stage-tools",
      from: `stage_${activeStage}`,
      to: "runtime_tools_hub",
      kind: "tool_filter",
      label: "filterToolsForStage",
    }),
  ];
}

export function buildParallelOverlayEdges(
  activeStage?: AgentPipelineStage | null,
  parallelStages: AgentPipelineStage[] = []
): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = [];
  for (const rule of PARALLEL_ACTIVATION_RULES) {
    if (parallelStages.includes(rule.stage) || activeStage === rule.stage) {
      edges.push(
        withRouting({
          id: `par-${rule.stage}`,
          from: "runtime_resolver_switch",
          to: `stage_${rule.stage}`,
          kind: "parallel",
          label: rule.activatesWhen,
          triggerType: "parallel",
        })
      );
    }
  }
  return edges;
}

export function buildStageTransitionEdges(): UnifiedGraphEdge[] {
  return CRM_TRANSITIONS.map((t) =>
    withRouting({
      id: t.id,
      from: `stage_${t.from}`,
      to: `stage_${t.to}`,
      kind: t.kind === "parallel" ? "parallel" : "stage_transition",
      label: t.label ?? t.trigger.label,
      triggerType: t.trigger.type,
    })
  );
}

export function buildEscalationBusEdges(): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = MAIN_STAGE_CODES.map((id, i) =>
    withRouting({
      id: `esc-bus-${i}`,
      from: `stage_${id}`,
      to: "anchor_escalation_bus",
      kind: "transversal",
      label: i === 0 ? "Escalar" : undefined,
    })
  );
  edges.push(
    withRouting({
      id: "esc-bus-dest",
      from: "anchor_escalation_bus",
      to: "stage_escalonamento",
      kind: "transversal",
    })
  );
  return edges;
}

export function buildTransversalRuntimeEdges(): UnifiedGraphEdge[] {
  return [
    withRouting({
      id: "ex-agent-esc",
      from: "runtime_agent",
      to: "anchor_escalation_bus",
      kind: "transversal",
      label: "escalar",
    }),
    withRouting({
      id: "ex-resp-esc",
      from: "runtime_response",
      to: "anchor_escalation_bus",
      kind: "transversal",
    }),
  ];
}

export function buildToolDependencyEdges(expandedStages: Set<string>): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = [];
  let idx = 0;
  for (const stage of AGENT_PIPELINE_STAGES) {
    if (!stage.requiredOrder || stage.requiredOrder.length < 2) continue;
    if (!expandedStages.has(stage.code)) continue;
    for (let i = 0; i < stage.requiredOrder.length - 1; i++) {
      edges.push(
        withRouting({
          id: `dep-${idx++}`,
          from: `tool_${stage.requiredOrder[i]!}`,
          to: `tool_${stage.requiredOrder[i + 1]!}`,
          kind: "tool_dependency",
        })
      );
    }
  }
  for (const { from, to } of EXTRA_TOOL_DEPENDENCIES) {
    const fromStage = getToolPrimaryStage(from);
    if (!fromStage || !expandedStages.has(fromStage)) continue;
    edges.push(withRouting({ id: `dep-${idx++}`, from: `tool_${from}`, to: `tool_${to}`, kind: "tool_dependency" }));
  }
  return edges;
}

export function buildStageToToolFilterEdges(expandedStages: Set<string>): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = [];
  let idx = 0;
  for (const stage of AGENT_PIPELINE_STAGES) {
    if (!expandedStages.has(stage.code)) continue;
    for (const toolName of [...stage.readTools, ...stage.mutatingTools]) {
      edges.push(
        withRouting({
          id: `sf-${idx++}`,
          from: `stage_${stage.code}`,
          to: `tool_${toolName}`,
          kind: "tool_filter",
        })
      );
    }
  }
  if (expandedStages.has("escalonamento")) {
    edges.push(
      withRouting({
        id: "sf-transfer",
        from: "stage_escalonamento",
        to: "tool_transfer_to_human",
        kind: "tool_filter",
      })
    );
  }
  return edges;
}

export type BuildUnifiedGraphOptions = {
  expandedStages?: Set<string>;
  activeStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
};

export function buildUnifiedGraph(opts: BuildUnifiedGraphOptions = {}): {
  nodes: UnifiedGraphNode[];
  edges: UnifiedGraphEdge[];
} {
  const expanded = opts.expandedStages ?? new Set<string>();
  const edges: UnifiedGraphEdge[] = [
    ...buildExecutionEdges(),
    ...buildStageTransitionEdges(),
    ...buildEscalationBusEdges(),
    ...buildSwitchToStageEdges(opts.activeStage),
    ...buildParallelOverlayEdges(opts.activeStage, opts.parallelStages ?? []),
    ...buildTransversalRuntimeEdges(),
    ...buildStageToToolFilterEdges(expanded),
    ...buildToolDependencyEdges(expanded),
  ];

  return {
    nodes: [
      ...buildSwimlaneNodes(),
      ...buildExecutionNodes(),
      ...ROUTE_ANCHOR_NODES,
      ...buildStageNodes(),
      ...buildToolNodes(expanded),
    ],
    edges,
  };
}

export function validateUnifiedGraphIntegrity(graph: {
  nodes: UnifiedGraphNode[];
  edges: UnifiedGraphEdge[];
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  for (const e of graph.edges) {
    if (e.to.startsWith("tool_") && !nodeIds.has(e.to)) continue;
    if (e.from.startsWith("tool_") && !nodeIds.has(e.from)) continue;
    if (!nodeIds.has(e.from)) errors.push(`Edge ${e.id}: missing source ${e.from}`);
    if (!nodeIds.has(e.to)) errors.push(`Edge ${e.id}: missing target ${e.to}`);
  }

  const crm = graph.edges.filter((e) => e.kind === "stage_transition" || e.kind === "parallel");
  const expected = AGENT_PIPELINE_FLOW_EDGES.filter((e) => e.kind !== "transversal");
  if (crm.length !== expected.length) errors.push(`CRM edges: expected ${expected.length}, got ${crm.length}`);

  const execNodes = graph.nodes.filter((n) => n.id.startsWith("runtime_"));
  if (execNodes.length < 14) errors.push(`Execution nodes: expected >=14, got ${execNodes.length}`);

  const switchNode = graph.nodes.find((n) => n.id === "runtime_resolver_switch");
  if (!switchNode) errors.push("Missing runtime_resolver_switch node");

  return { ok: errors.length === 0, errors };
}

export const RUNTIME_PATH_MAP: Record<string, string[]> = {
  request: ["ex-msg-debounce", "ex-debounce-intent"],
  router: ["ex-msg-debounce", "ex-debounce-intent", "ex-intent-router", "ex-router-escalate"],
  agent: ["ex-escalate-agent"],
  memory: ["ex-agent-journey", "ex-journey-switch", "dyn-switch-stage"],
  tools: [
    "ex-switch-tools",
    "dyn-stage-tools",
    "ex-tools-validate",
    "ex-validate-confirm",
    "ex-confirm-execute",
    "ex-execute-agent",
  ],
  response: ["ex-agent-response", "ex-response-end"],
  handoff: ["ex-escalate-handoff", "ex-handoff-end"],
  retry: ["ex-msg-debounce", "ex-intent-router"],
  done: ["ex-response-end"],
  failed: ["ex-response-end"],
};

export const EDGE_STYLES: Record<
  UnifiedEdgeKind,
  { stroke: string; strokeWidth: number; strokeDasharray?: string }
> = {
  runtime: { stroke: "#06b6d4", strokeWidth: 2 },
  context: { stroke: "#d946ef", strokeWidth: 2 },
  stage_transition: { stroke: "#8b5cf6", strokeWidth: 2 },
  tool_filter: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "6 4" },
  tool_dependency: { stroke: "#f59e0b", strokeWidth: 2 },
  parallel: { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: "6 4" },
  transversal: { stroke: "#ef4444", strokeWidth: 2.5, strokeDasharray: "4 4" },
  return: { stroke: "#f59e0b", strokeWidth: 2.5 },
};

export const EDGE_KIND_LABELS: Record<UnifiedEdgeKind, string> = {
  runtime: "Runtime (mensagem → agente)",
  context: "Contexto (jornada / resolver)",
  stage_transition: "Transição de etapa CRM",
  tool_filter: "Filtro de ferramentas",
  tool_dependency: "Ordem obrigatória entre tools",
  parallel: "Trilha paralela (overlay)",
  transversal: "Escalonamento / saída",
  return: "Retorno (loop tool calls)",
};

export const FLOW_EXPLANATION = {
  title: "Como a IA processa cada mensagem",
  steps: [
    "Lane 1: Mensagem → intent → router → booking ou agente → loop tools → resposta",
    "Lane 2: Switch Resolver escolhe etapa (prioridade 1→9)",
    "Lane 3: Jornada CRM — transições possíveis entre etapas",
    "Lane 4: Paralelas (financeiro, formulários) ativam por intent/journey",
    "Lane 5: Saídas — handoff, escalonamento, fim do ciclo",
  ],
};

export { EXECUTION_NODES, RESOLVER_SWITCH_RULES, PLAYBACK_STEPS } from "./flow-model";
