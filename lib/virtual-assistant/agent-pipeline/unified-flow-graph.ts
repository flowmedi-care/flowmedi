import { ASSISTANT_TOOL_CATALOG } from "../tools/catalog";
import { MUTATING_TOOL_NAMES } from "./constants";
import {
  AGENT_PIPELINE_FLOW_EDGES,
  AGENT_PIPELINE_FLOW_NODES,
} from "./flow-graph";
import {
  AGENT_PIPELINE_STAGES,
  type AgentPipelineStage,
} from "./stages";
import {
  deriveEdgeRouting,
  getNodePosition,
  getToolPosition,
  MAIN_STAGE_CODES,
  NODE_POSITIONS,
  POOL_BOUNDS,
} from "./pool-layout";

export type UnifiedNodeKind = "runtime" | "stage" | "tool" | "hub" | "anchor" | "pool";

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
  parentId?: string;
  stageCode?: AgentPipelineStage | "escalonamento";
  toolName?: string;
  toolCategory?: string;
  mutating?: boolean;
  crmPhase?: string;
  runtimeIcon?: "message" | "router" | "agent" | "journey" | "tools" | "response" | "debounce" | "booking" | "confirm" | "resolver";
  poolId?: string;
  poolWidth?: number;
  poolHeight?: number;
};

export type UnifiedGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: UnifiedEdgeKind;
  label?: string;
  routing?: import("./pool-layout").EdgeRoutingMode;
};

export const RUNTIME_NODES: UnifiedGraphNode[] = [
  {
    id: "runtime_msg",
    kind: "runtime",
    label: "Mensagem",
    shortLabel: "MENSAGEM",
    description: "Webhook WhatsApp inbound",
    position: getNodePosition("runtime_msg"),
    runtimeIcon: "message",
    poolId: "ingress",
  },
  {
    id: "runtime_debounce",
    kind: "runtime",
    label: "Debounce",
    shortLabel: "DEBOUNCE",
    description: "Aguarda mensagens agrupadas",
    position: getNodePosition("runtime_debounce"),
    runtimeIcon: "debounce",
    poolId: "ingress",
  },
  {
    id: "runtime_router",
    kind: "runtime",
    label: "Roteador",
    shortLabel: "ROTEADOR",
    description: "intent-router + detect-inbound-intent",
    position: getNodePosition("runtime_router"),
    runtimeIcon: "router",
    poolId: "ingress",
  },
  {
    id: "runtime_booking",
    kind: "runtime",
    label: "Booking Machine",
    shortLabel: "BOOKING",
    description: "Fluxo determinístico de agendamento",
    position: getNodePosition("runtime_booking"),
    runtimeIcon: "booking",
    poolId: "execution",
  },
  {
    id: "runtime_agent",
    kind: "runtime",
    label: "Agente",
    shortLabel: "AGENTE",
    description: "OpenAI function calling loop",
    position: getNodePosition("runtime_agent"),
    runtimeIcon: "agent",
    poolId: "execution",
  },
  {
    id: "runtime_journey",
    kind: "runtime",
    label: "Jornada CRM",
    shortLabel: "JORNADA",
    description: "loadContactJourneyForAi preload",
    position: getNodePosition("runtime_journey"),
    runtimeIcon: "journey",
    poolId: "execution",
  },
  {
    id: "runtime_resolver",
    kind: "runtime",
    label: "Resolver etapa",
    shortLabel: "RESOLVER",
    description: "resolveAgentPipelineStage",
    position: getNodePosition("runtime_resolver"),
    runtimeIcon: "resolver",
    poolId: "execution",
  },
  {
    id: "runtime_tools_hub",
    kind: "hub",
    label: "Ferramentas filtradas",
    shortLabel: "TOOLS",
    description: "filterToolsForStage — subset por etapa",
    position: getNodePosition("runtime_tools_hub"),
    runtimeIcon: "tools",
    poolId: "execution",
  },
  {
    id: "runtime_confirm_gate",
    kind: "runtime",
    label: "Confirmação",
    shortLabel: "CONFIRM",
    description: "human_confirm gate por tool",
    position: getNodePosition("runtime_confirm_gate"),
    runtimeIcon: "confirm",
    poolId: "execution",
  },
  {
    id: "runtime_response",
    kind: "runtime",
    label: "Resposta",
    shortLabel: "RESPOSTA",
    description: "send-reply WhatsApp",
    position: getNodePosition("runtime_response"),
    runtimeIcon: "response",
    poolId: "execution",
  },
];

export const ROUTE_ANCHOR_NODES: UnifiedGraphNode[] = [
  {
    id: "anchor_loop_bus",
    kind: "anchor",
    label: "",
    position: getNodePosition("anchor_loop_bus"),
  },
  {
    id: "anchor_escalation_bus",
    kind: "anchor",
    label: "",
    position: getNodePosition("anchor_escalation_bus"),
  },
];

export const RUNTIME_EDGES: UnifiedGraphEdge[] = [
  { id: "rt-msg-debounce", from: "runtime_msg", to: "runtime_debounce", kind: "runtime", routing: "direct" },
  { id: "rt-debounce-router", from: "runtime_debounce", to: "runtime_router", kind: "runtime", routing: "direct" },
  { id: "rt-router-booking", from: "runtime_router", to: "runtime_booking", kind: "runtime", label: "booking", routing: "vertical-up" },
  { id: "rt-router-agent", from: "runtime_router", to: "runtime_agent", kind: "runtime", routing: "direct" },
  { id: "rt-booking-agent", from: "runtime_booking", to: "runtime_agent", kind: "runtime", routing: "vertical-down" },
  { id: "rt-agent-journey", from: "runtime_agent", to: "runtime_journey", kind: "context", routing: "vertical-down" },
  { id: "rt-journey-resolver", from: "runtime_journey", to: "runtime_resolver", kind: "context", routing: "direct" },
  { id: "rt-resolver-tools", from: "runtime_resolver", to: "runtime_tools_hub", kind: "tool_filter", routing: "direct" },
  { id: "rt-tools-confirm", from: "runtime_tools_hub", to: "runtime_confirm_gate", kind: "runtime", routing: "direct" },
  { id: "rt-confirm-loopbus", from: "runtime_confirm_gate", to: "anchor_loop_bus", kind: "return", label: "loop", routing: "loop" },
  { id: "rt-loopbus-agent", from: "anchor_loop_bus", to: "runtime_agent", kind: "return", routing: "loop" },
  { id: "rt-agent-response", from: "runtime_agent", to: "runtime_response", kind: "return", routing: "direct" },
];

export const EXTRA_TOOL_DEPENDENCIES: { from: string; to: string }[] = [
  { from: "list_patient_appointments", to: "confirm_appointment" },
  { from: "list_patient_appointments", to: "cancel_appointment" },
  { from: "list_patient_appointments", to: "reschedule_appointment" },
];

const mutatingSet = new Set<string>(MUTATING_TOOL_NAMES);

export function getToolPrimaryStage(toolName: string): AgentPipelineStage | "escalonamento" | null {
  if (toolName === "transfer_to_human") return "escalonamento";
  for (const stage of AGENT_PIPELINE_STAGES) {
    if (stage.readTools.includes(toolName) || stage.mutatingTools.includes(toolName)) {
      return stage.code;
    }
  }
  return null;
}

export function buildPoolNodes(): UnifiedGraphNode[] {
  return POOL_BOUNDS.map((p) => ({
    id: `pool_${p.id}`,
    kind: "pool" as const,
    label: p.label,
    position: { x: p.x, y: p.y },
    poolId: p.id,
    poolWidth: p.width,
    poolHeight: p.height,
  }));
}

export function buildStageNodes(): UnifiedGraphNode[] {
  return AGENT_PIPELINE_FLOW_NODES.map((n) => {
    const nodeId = `stage_${n.id}`;
    const pos = NODE_POSITIONS[nodeId];
    return {
      id: nodeId,
      kind: "stage" as const,
      label: n.label,
      shortLabel: n.shortLabel,
      stageCode: n.id,
      crmPhase: n.crmPhase,
      position: pos ? { x: pos.x, y: pos.y } : getNodePosition(nodeId),
      poolId: pos?.pool,
    };
  });
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
        poolId: "parallel",
      });
    });
    expandedIndex++;
  }

  return nodes;
}

function withRouting(edge: Omit<UnifiedGraphEdge, "routing">): UnifiedGraphEdge {
  return {
    ...edge,
    routing: deriveEdgeRouting(edge.from, edge.to, edge.kind, edge.id),
  };
}

export function buildStageTransitionEdges(): UnifiedGraphEdge[] {
  return AGENT_PIPELINE_FLOW_EDGES.filter((e) => e.kind !== "transversal").map((e, i) =>
    withRouting({
      id: `st-${i}`,
      from: `stage_${e.from}`,
      to: `stage_${e.to}`,
      kind: e.kind === "parallel" ? "parallel" : "stage_transition",
      label: e.label,
    })
  );
}

/** Todas as 7 etapas main → bus → escalonamento */
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

export function buildDynamicStageEdges(
  activeStage?: AgentPipelineStage | null,
  parallelStages: AgentPipelineStage[] = []
): UnifiedGraphEdge[] {
  if (!activeStage) return [];

  const edges: UnifiedGraphEdge[] = [
    withRouting({
      id: "dyn-resolver-stage",
      from: "runtime_resolver",
      to: `stage_${activeStage}`,
      kind: "context",
      label: "etapa ativa",
    }),
    withRouting({
      id: "dyn-stage-tools",
      from: `stage_${activeStage}`,
      to: "runtime_tools_hub",
      kind: "tool_filter",
      label: "filterToolsForStage",
    }),
  ];

  for (const ps of parallelStages) {
    if (ps === activeStage) continue;
    edges.push(
      withRouting({
        id: `dyn-parallel-${ps}`,
        from: `stage_${ps}`,
        to: "runtime_tools_hub",
        kind: "parallel",
      })
    );
  }

  return edges;
}

export function buildToolDependencyEdges(expandedStages: Set<string>): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = [];
  let idx = 0;

  for (const stage of AGENT_PIPELINE_STAGES) {
    if (!stage.requiredOrder || stage.requiredOrder.length < 2) continue;
    if (!expandedStages.has(stage.code)) continue;
    for (let i = 0; i < stage.requiredOrder.length - 1; i++) {
      const from = stage.requiredOrder[i]!;
      const to = stage.requiredOrder[i + 1]!;
      edges.push(
        withRouting({
          id: `dep-${idx++}`,
          from: `tool_${from}`,
          to: `tool_${to}`,
          kind: "tool_dependency",
        })
      );
    }
  }

  for (const { from, to } of EXTRA_TOOL_DEPENDENCIES) {
    const fromStage = getToolPrimaryStage(from);
    const stageKey = fromStage ?? "";
    if (!expandedStages.has(stageKey)) continue;
    edges.push(
      withRouting({
        id: `dep-${idx++}`,
        from: `tool_${from}`,
        to: `tool_${to}`,
        kind: "tool_dependency",
      })
    );
  }

  return edges;
}

export function buildStageToToolFilterEdges(expandedStages: Set<string>): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = [];
  let idx = 0;

  for (const stage of AGENT_PIPELINE_STAGES) {
    if (!expandedStages.has(stage.code)) continue;
    const allTools = [...stage.readTools, ...stage.mutatingTools];
    for (const toolName of allTools) {
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

export function buildTransversalRuntimeEdges(): UnifiedGraphEdge[] {
  return [
    withRouting({
      id: "rt-agent-esc",
      from: "runtime_agent",
      to: "anchor_escalation_bus",
      kind: "transversal",
      label: "escalar",
    }),
    withRouting({
      id: "rt-resp-esc",
      from: "runtime_response",
      to: "anchor_escalation_bus",
      kind: "transversal",
    }),
  ];
}

export type BuildUnifiedGraphOptions = {
  expandedStages?: Set<string>;
  activeStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
  includePools?: boolean;
};

export function buildUnifiedGraph(opts: BuildUnifiedGraphOptions = {}): {
  nodes: UnifiedGraphNode[];
  edges: UnifiedGraphEdge[];
} {
  const expanded = opts.expandedStages ?? new Set<string>();
  const poolNodes = opts.includePools !== false ? buildPoolNodes() : [];
  const stageNodes = buildStageNodes();
  const toolNodes = buildToolNodes(expanded);

  const edges: UnifiedGraphEdge[] = [
    ...RUNTIME_EDGES,
    ...buildStageTransitionEdges(),
    ...buildEscalationBusEdges(),
    ...buildDynamicStageEdges(opts.activeStage, opts.parallelStages ?? []),
    ...buildTransversalRuntimeEdges(),
    ...buildStageToToolFilterEdges(expanded),
    ...buildToolDependencyEdges(expanded),
  ];

  return {
    nodes: [...poolNodes, ...RUNTIME_NODES, ...ROUTE_ANCHOR_NODES, ...stageNodes, ...toolNodes],
    edges,
  };
}

/** Valida integridade do grafo vs flow-graph.ts */
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

  const crmEdges = graph.edges.filter(
    (e) => e.kind === "stage_transition" || e.kind === "parallel"
  );
  const expectedCrm = AGENT_PIPELINE_FLOW_EDGES.filter((e) => e.kind !== "transversal");
  if (crmEdges.length !== expectedCrm.length) {
    errors.push(`CRM edges: expected ${expectedCrm.length}, got ${crmEdges.length}`);
  }

  for (const fe of expectedCrm) {
    const found = crmEdges.some(
      (e) => e.from === `stage_${fe.from}` && e.to === `stage_${fe.to}`
    );
    if (!found) errors.push(`Missing CRM edge ${fe.from} → ${fe.to}`);
  }

  const transversalToEsc = graph.edges.filter(
    (e) => e.kind === "transversal" && e.to === "stage_escalonamento"
  );
  if (transversalToEsc.length !== 1) {
    errors.push(`Expected 1 edge to escalonamento, got ${transversalToEsc.length}`);
  }

  const transversalFromMain = graph.edges.filter(
    (e) => e.kind === "transversal" && e.to === "anchor_escalation_bus"
  );
  if (transversalFromMain.length !== MAIN_STAGE_CODES.length + 2) {
    errors.push(
      `Expected ${MAIN_STAGE_CODES.length + 2} transversal to bus, got ${transversalFromMain.length}`
    );
  }

  return { ok: errors.length === 0, errors };
}

export const RUNTIME_PATH_MAP: Record<string, string[]> = {
  request: ["rt-msg-debounce", "rt-debounce-router"],
  router: ["rt-msg-debounce", "rt-debounce-router", "rt-router-agent"],
  agent: ["rt-router-agent"],
  memory: ["rt-router-agent", "rt-agent-journey", "rt-journey-resolver", "dyn-resolver-stage"],
  tools: [
    "rt-router-agent",
    "rt-agent-journey",
    "rt-journey-resolver",
    "rt-resolver-tools",
    "dyn-resolver-stage",
    "dyn-stage-tools",
    "rt-tools-confirm",
    "rt-confirm-loopbus",
    "rt-loopbus-agent",
  ],
  response: ["rt-agent-response"],
  handoff: ["rt-agent-response", "rt-agent-esc"],
  retry: ["rt-msg-debounce", "rt-debounce-router", "rt-router-agent"],
  done: ["rt-agent-response"],
  failed: ["rt-agent-response"],
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
  parallel: "Trilha paralela",
  transversal: "Escalonamento global",
  return: "Retorno (tools → resposta)",
};

export const FLOW_EXPLANATION = {
  title: "Como a IA processa cada mensagem",
  steps: [
    "Mensagem → debounce → roteador (booking ou agente LLM)",
    "Agente carrega jornada CRM e o resolver escolhe a etapa ativa",
    "filterToolsForStage libera só as tools da etapa (+ paralelas + transfer_to_human)",
    "Loop de tool calls com confirmação opcional → resposta WhatsApp",
    "Setas roxas CRM = transições possíveis da jornada (não todas por mensagem)",
  ],
};
