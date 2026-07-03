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

export type UnifiedNodeKind = "runtime" | "stage" | "tool" | "hub";

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
  /** stage code for stage nodes */
  stageCode?: AgentPipelineStage | "escalonamento";
  /** tool name for tool nodes */
  toolName?: string;
  toolCategory?: string;
  mutating?: boolean;
  crmPhase?: string;
  runtimeIcon?: "message" | "router" | "agent" | "journey" | "tools" | "response" | "debounce" | "booking" | "confirm" | "resolver";
};

export type UnifiedGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: UnifiedEdgeKind;
  label?: string;
};

/** Posições fixas — swimlanes */
const RUNTIME_Y = 20;
const CONTEXT_Y = 130;
const STAGE_Y = 300;
const PARALLEL_Y = 440;

const STAGE_POSITIONS: Record<string, { x: number; y: number }> = {
  identificacao: { x: 0, y: STAGE_Y },
  captacao: { x: 200, y: STAGE_Y },
  orcamento: { x: 400, y: STAGE_Y - 60 },
  agendamento: { x: 400, y: STAGE_Y + 60 },
  confirmacao_pre_consulta: { x: 620, y: STAGE_Y },
  pos_consulta: { x: 820, y: STAGE_Y },
  satisfacao: { x: 1020, y: STAGE_Y },
  financeiro: { x: 400, y: PARALLEL_Y },
  formularios: { x: 620, y: PARALLEL_Y },
  escalonamento: { x: 820, y: PARALLEL_Y },
};

export const RUNTIME_NODES: UnifiedGraphNode[] = [
  {
    id: "runtime_msg",
    kind: "runtime",
    label: "Mensagem",
    shortLabel: "MENSAGEM",
    description: "Webhook WhatsApp inbound",
    position: { x: 0, y: RUNTIME_Y },
    runtimeIcon: "message",
  },
  {
    id: "runtime_debounce",
    kind: "runtime",
    label: "Debounce",
    shortLabel: "DEBOUNCE",
    description: "Aguarda mensagens agrupadas",
    position: { x: 150, y: RUNTIME_Y },
    runtimeIcon: "debounce",
  },
  {
    id: "runtime_router",
    kind: "runtime",
    label: "Roteador",
    shortLabel: "ROTEADOR",
    description: "intent-router + detect-inbound-intent",
    position: { x: 300, y: RUNTIME_Y },
    runtimeIcon: "router",
  },
  {
    id: "runtime_booking",
    kind: "runtime",
    label: "Booking Machine",
    shortLabel: "BOOKING",
    description: "Fluxo determinístico de agendamento",
    position: { x: 450, y: RUNTIME_Y - 50 },
    runtimeIcon: "booking",
  },
  {
    id: "runtime_agent",
    kind: "runtime",
    label: "Agente",
    shortLabel: "AGENTE",
    description: "OpenAI function calling loop",
    position: { x: 450, y: RUNTIME_Y + 30 },
    runtimeIcon: "agent",
  },
  {
    id: "runtime_journey",
    kind: "runtime",
    label: "Jornada CRM",
    shortLabel: "JORNADA",
    description: "loadContactJourneyForAi preload",
    position: { x: 300, y: CONTEXT_Y },
    runtimeIcon: "journey",
  },
  {
    id: "runtime_resolver",
    kind: "runtime",
    label: "Resolver etapa",
    shortLabel: "RESOLVER",
    description: "resolveAgentPipelineStage",
    position: { x: 600, y: CONTEXT_Y },
    runtimeIcon: "resolver",
  },
  {
    id: "runtime_tools_hub",
    kind: "hub",
    label: "Ferramentas filtradas",
    shortLabel: "TOOLS",
    description: "filterToolsForStage — subset por etapa",
    position: { x: 750, y: CONTEXT_Y },
    runtimeIcon: "tools",
  },
  {
    id: "runtime_confirm_gate",
    kind: "runtime",
    label: "Confirmação",
    shortLabel: "CONFIRM",
    description: "human_confirm gate por tool",
    position: { x: 900, y: CONTEXT_Y },
    runtimeIcon: "confirm",
  },
  {
    id: "runtime_response",
    kind: "runtime",
    label: "Resposta",
    shortLabel: "RESPOSTA",
    description: "send-reply WhatsApp",
    position: { x: 1050, y: RUNTIME_Y + 30 },
    runtimeIcon: "response",
  },
];

export const RUNTIME_EDGES: UnifiedGraphEdge[] = [
  { id: "rt-msg-debounce", from: "runtime_msg", to: "runtime_debounce", kind: "runtime" },
  { id: "rt-debounce-router", from: "runtime_debounce", to: "runtime_router", kind: "runtime" },
  { id: "rt-router-booking", from: "runtime_router", to: "runtime_booking", kind: "runtime", label: "booking" },
  { id: "rt-router-agent", from: "runtime_router", to: "runtime_agent", kind: "runtime" },
  { id: "rt-booking-agent", from: "runtime_booking", to: "runtime_agent", kind: "runtime" },
  { id: "rt-agent-journey", from: "runtime_agent", to: "runtime_journey", kind: "context" },
  { id: "rt-journey-agent", from: "runtime_journey", to: "runtime_agent", kind: "context" },
  { id: "rt-agent-resolver", from: "runtime_agent", to: "runtime_resolver", kind: "context" },
  { id: "rt-journey-resolver", from: "runtime_journey", to: "runtime_resolver", kind: "context" },
  { id: "rt-resolver-tools", from: "runtime_resolver", to: "runtime_tools_hub", kind: "tool_filter" },
  { id: "rt-agent-tools", from: "runtime_agent", to: "runtime_tools_hub", kind: "tool_filter" },
  { id: "rt-tools-confirm", from: "runtime_tools_hub", to: "runtime_confirm_gate", kind: "runtime" },
  { id: "rt-confirm-agent", from: "runtime_confirm_gate", to: "runtime_agent", kind: "return", label: "loop" },
  { id: "rt-tools-agent", from: "runtime_tools_hub", to: "runtime_agent", kind: "return" },
  { id: "rt-agent-response", from: "runtime_agent", to: "runtime_response", kind: "return" },
];

/** Dependências obrigatórias entre tools (além de requiredOrder em stages). */
export const EXTRA_TOOL_DEPENDENCIES: { from: string; to: string }[] = [
  { from: "list_patient_appointments", to: "confirm_appointment" },
  { from: "list_patient_appointments", to: "cancel_appointment" },
  { from: "list_patient_appointments", to: "reschedule_appointment" },
];

const mutatingSet = new Set<string>(MUTATING_TOOL_NAMES);

/** Mapeia tool → etapa principal (primeira ocorrência). */
export function getToolPrimaryStage(toolName: string): AgentPipelineStage | "escalonamento" | null {
  if (toolName === "transfer_to_human") return "escalonamento";
  for (const stage of AGENT_PIPELINE_STAGES) {
    if (stage.readTools.includes(toolName) || stage.mutatingTools.includes(toolName)) {
      return stage.code;
    }
  }
  return null;
}

export function buildStageNodes(): UnifiedGraphNode[] {
  return AGENT_PIPELINE_FLOW_NODES.map((n) => ({
    id: `stage_${n.id}`,
    kind: "stage" as const,
    label: n.label,
    shortLabel: n.shortLabel,
    stageCode: n.id,
    crmPhase: n.crmPhase,
    position: STAGE_POSITIONS[n.id] ?? { x: n.col * 200, y: STAGE_Y },
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

  for (const [stageKey, toolNames] of toolsByStage) {
    if (!expandedStages.has(stageKey)) continue;
    const parentId = `stage_${stageKey}`;
    const basePos = STAGE_POSITIONS[stageKey] ?? { x: 0, y: STAGE_Y };
    toolNames.forEach((toolName, i) => {
      const entry = ASSISTANT_TOOL_CATALOG.find((t) => t.name === toolName)!;
      const col = i % 4;
      const row = Math.floor(i / 4);
      nodes.push({
        id: `tool_${toolName}`,
        kind: "tool",
        label: entry.label,
        shortLabel: entry.label,
        toolName,
        toolCategory: entry.category,
        mutating: mutatingSet.has(toolName),
        parentId,
        position: { x: col * 110 + 10, y: row * 52 + 70 },
        stageCode: stageKey === "escalonamento" ? "escalonamento" : (stageKey as AgentPipelineStage),
      });
    });
    // Adjust parent stage to contain children - use extent in ReactFlow
    void basePos;
  }

  return nodes;
}

export function buildStageTransitionEdges(): UnifiedGraphEdge[] {
  return AGENT_PIPELINE_FLOW_EDGES.map((e, i) => ({
    id: `st-${i}`,
    from: `stage_${e.from}`,
    to: `stage_${e.to}`,
    kind: e.kind === "transversal" ? "transversal" : e.kind === "parallel" ? "parallel" : "stage_transition",
    label: e.label,
  }));
}

export function buildResolverToStageEdges(): UnifiedGraphEdge[] {
  return AGENT_PIPELINE_FLOW_NODES.filter((n) => n.kind === "main" || n.kind === "parallel").map(
    (n) => ({
      id: `res-stage-${n.id}`,
      from: "runtime_resolver",
      to: `stage_${n.id}`,
      kind: "context" as const,
      label: "pode ir",
    })
  );
}

export function buildStageToToolsHubEdges(): UnifiedGraphEdge[] {
  return AGENT_PIPELINE_FLOW_NODES.map((n) => ({
    id: `stage-tools-${n.id}`,
    from: `stage_${n.id}`,
    to: "runtime_tools_hub",
    kind: "tool_filter" as const,
  }));
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
      edges.push({
        id: `dep-${idx++}`,
        from: `tool_${from}`,
        to: `tool_${to}`,
        kind: "tool_dependency",
      });
    }
  }

  for (const { from, to } of EXTRA_TOOL_DEPENDENCIES) {
    const fromStage = getToolPrimaryStage(from);
    const stageKey = fromStage ?? "";
    if (!expandedStages.has(stageKey)) continue;
    edges.push({
      id: `dep-${idx++}`,
      from: `tool_${from}`,
      to: `tool_${to}`,
      kind: "tool_dependency",
    });
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
      if (!expandedStages.has(stage.code)) continue;
      edges.push({
        id: `sf-${idx++}`,
        from: `stage_${stage.code}`,
        to: `tool_${toolName}`,
        kind: "tool_filter",
      });
    }
  }

  if (expandedStages.has("escalonamento")) {
    edges.push({
      id: "sf-transfer",
      from: "stage_escalonamento",
      to: "tool_transfer_to_human",
      kind: "tool_filter",
    });
  }

  return edges;
}

export function buildToolsHubToToolEdges(expandedStages: Set<string>): UnifiedGraphEdge[] {
  const edges: UnifiedGraphEdge[] = [];
  let idx = 0;

  for (const entry of ASSISTANT_TOOL_CATALOG) {
    const stage = getToolPrimaryStage(entry.name);
    if (!stage) continue;
    const stageKey = stage === "escalonamento" ? "escalonamento" : stage;
    if (!expandedStages.has(stageKey)) continue;
    edges.push({
      id: `hub-${idx++}`,
      from: "runtime_tools_hub",
      to: `tool_${entry.name}`,
      kind: "tool_filter",
    });
  }

  return edges;
}

export function buildTransversalRuntimeEdges(): UnifiedGraphEdge[] {
  return [
    {
      id: "rt-agent-esc",
      from: "runtime_agent",
      to: "stage_escalonamento",
      kind: "transversal",
      label: "escalar",
    },
    {
      id: "rt-resp-esc",
      from: "runtime_response",
      to: "stage_escalonamento",
      kind: "transversal",
    },
  ];
}

export type BuildUnifiedGraphOptions = {
  expandedStages?: Set<string>;
};

export function buildUnifiedGraph(opts: BuildUnifiedGraphOptions = {}): {
  nodes: UnifiedGraphNode[];
  edges: UnifiedGraphEdge[];
} {
  const expanded = opts.expandedStages ?? new Set<string>();

  const stageNodes = buildStageNodes();
  const toolNodes = buildToolNodes(expanded);

  const edges: UnifiedGraphEdge[] = [
    ...RUNTIME_EDGES,
    ...buildStageTransitionEdges(),
    ...buildResolverToStageEdges(),
    ...buildStageToToolsHubEdges(),
    ...buildTransversalRuntimeEdges(),
    ...buildStageToToolFilterEdges(expanded),
    ...buildToolsHubToToolEdges(expanded),
    ...buildToolDependencyEdges(expanded),
  ];

  return {
    nodes: [...RUNTIME_NODES, ...stageNodes, ...toolNodes],
    edges,
  };
}

/** IDs de arestas runtime para animação demo (compatível com pipeline-trace paths). */
export const RUNTIME_PATH_MAP: Record<string, string[]> = {
  request: ["rt-msg-debounce", "rt-debounce-router"],
  router: ["rt-msg-debounce", "rt-debounce-router", "rt-router-agent"],
  agent: ["rt-router-agent"],
  memory: ["rt-router-agent", "rt-agent-journey", "rt-journey-agent", "rt-agent-resolver"],
  tools: ["rt-router-agent", "rt-agent-tools", "rt-resolver-tools", "rt-tools-agent"],
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
  tool_dependency: { stroke: "#f59e0b", strokeWidth: 1 },
  parallel: { stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "6 4" },
  transversal: { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "4 4" },
  return: { stroke: "#f59e0b", strokeWidth: 2 },
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
