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

/** Swimlanes — espaçamento generoso para evitar linhas sobre nós */
const LAYOUT = {
  /** Faixa 1: runtime horizontal */
  runtimeY: 0,
  runtimeStepX: 240,
  /** Faixa 2: contexto (jornada, resolver, tools) */
  contextY: 220,
  /** Faixa 3: etapas CRM — linha principal */
  stageMainY: 520,
  /** Faixa 4: trilhas paralelas */
  parallelY: 740,
  /** Faixa 5: tools expandidas */
  toolRowY: 960,
  /** Coluna principal entre etapas */
  stageStepX: 420,
  /** Coluna lateral (orçamento / agendamento / financeiro) */
  branchX: 880,
  branchOrcamentoY: 440,
  branchAgendamentoY: 640,
  branchFinanceiroY: 740,
  /** Offset vertical entre grupos de tools */
  toolGroupGapY: 180,
  toolColGapX: 130,
  toolRowGapY: 56,
} as const;

const STAGE_POSITIONS: Record<string, { x: number; y: number }> = {
  identificacao: { x: 0, y: LAYOUT.stageMainY },
  captacao: { x: LAYOUT.stageStepX, y: LAYOUT.stageMainY },
  orcamento: { x: LAYOUT.branchX, y: LAYOUT.branchOrcamentoY },
  agendamento: { x: LAYOUT.branchX, y: LAYOUT.branchAgendamentoY },
  confirmacao_pre_consulta: { x: LAYOUT.stageStepX * 3, y: LAYOUT.stageMainY },
  pos_consulta: { x: LAYOUT.stageStepX * 4, y: LAYOUT.stageMainY },
  satisfacao: { x: LAYOUT.stageStepX * 5, y: LAYOUT.stageMainY },
  financeiro: { x: LAYOUT.branchX, y: LAYOUT.branchFinanceiroY },
  formularios: { x: LAYOUT.stageStepX * 3, y: LAYOUT.parallelY },
  escalonamento: { x: LAYOUT.stageStepX * 4, y: LAYOUT.parallelY },
};

export const RUNTIME_NODES: UnifiedGraphNode[] = [
  {
    id: "runtime_msg",
    kind: "runtime",
    label: "Mensagem",
    shortLabel: "MENSAGEM",
    description: "Webhook WhatsApp inbound",
    position: { x: 0, y: LAYOUT.runtimeY },
    runtimeIcon: "message",
  },
  {
    id: "runtime_debounce",
    kind: "runtime",
    label: "Debounce",
    shortLabel: "DEBOUNCE",
    description: "Aguarda mensagens agrupadas",
    position: { x: LAYOUT.runtimeStepX, y: LAYOUT.runtimeY },
    runtimeIcon: "debounce",
  },
  {
    id: "runtime_router",
    kind: "runtime",
    label: "Roteador",
    shortLabel: "ROTEADOR",
    description: "intent-router + detect-inbound-intent",
    position: { x: LAYOUT.runtimeStepX * 2, y: LAYOUT.runtimeY },
    runtimeIcon: "router",
  },
  {
    id: "runtime_booking",
    kind: "runtime",
    label: "Booking Machine",
    shortLabel: "BOOKING",
    description: "Fluxo determinístico de agendamento",
    position: { x: LAYOUT.runtimeStepX * 3, y: LAYOUT.runtimeY - 90 },
    runtimeIcon: "booking",
  },
  {
    id: "runtime_agent",
    kind: "runtime",
    label: "Agente",
    shortLabel: "AGENTE",
    description: "OpenAI function calling loop",
    position: { x: LAYOUT.runtimeStepX * 3, y: LAYOUT.runtimeY + 90 },
    runtimeIcon: "agent",
  },
  {
    id: "runtime_journey",
    kind: "runtime",
    label: "Jornada CRM",
    shortLabel: "JORNADA",
    description: "loadContactJourneyForAi preload",
    position: { x: LAYOUT.runtimeStepX * 2 - 40, y: LAYOUT.contextY },
    runtimeIcon: "journey",
  },
  {
    id: "runtime_resolver",
    kind: "runtime",
    label: "Resolver etapa",
    shortLabel: "RESOLVER",
    description: "resolveAgentPipelineStage",
    position: { x: LAYOUT.runtimeStepX * 4, y: LAYOUT.contextY },
    runtimeIcon: "resolver",
  },
  {
    id: "runtime_tools_hub",
    kind: "hub",
    label: "Ferramentas filtradas",
    shortLabel: "TOOLS",
    description: "filterToolsForStage — subset por etapa",
    position: { x: LAYOUT.runtimeStepX * 5, y: LAYOUT.contextY },
    runtimeIcon: "tools",
  },
  {
    id: "runtime_confirm_gate",
    kind: "runtime",
    label: "Confirmação",
    shortLabel: "CONFIRM",
    description: "human_confirm gate por tool",
    position: { x: LAYOUT.runtimeStepX * 6, y: LAYOUT.contextY },
    runtimeIcon: "confirm",
  },
  {
    id: "runtime_response",
    kind: "runtime",
    label: "Resposta",
    shortLabel: "RESPOSTA",
    description: "send-reply WhatsApp",
    position: { x: LAYOUT.runtimeStepX * 7, y: LAYOUT.runtimeY + 90 },
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
  { id: "rt-journey-resolver", from: "runtime_journey", to: "runtime_resolver", kind: "context" },
  { id: "rt-agent-resolver", from: "runtime_agent", to: "runtime_resolver", kind: "context" },
  { id: "rt-resolver-tools", from: "runtime_resolver", to: "runtime_tools_hub", kind: "tool_filter" },
  { id: "rt-tools-confirm", from: "runtime_tools_hub", to: "runtime_confirm_gate", kind: "runtime" },
  { id: "rt-confirm-agent", from: "runtime_confirm_gate", to: "runtime_agent", kind: "return", label: "loop" },
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
    position: STAGE_POSITIONS[n.id] ?? { x: n.col * LAYOUT.stageStepX, y: LAYOUT.stageMainY },
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
    const basePos = STAGE_POSITIONS[stageKey] ?? { x: 0, y: LAYOUT.stageMainY };
    const rowOffset = expandedIndex * LAYOUT.toolGroupGapY;
    expandedIndex++;

    toolNames.forEach((toolName, i) => {
      const entry = ASSISTANT_TOOL_CATALOG.find((t) => t.name === toolName)!;
      const col = i % 3;
      const row = Math.floor(i / 3);
      nodes.push({
        id: `tool_${toolName}`,
        kind: "tool",
        label: entry.label,
        shortLabel: entry.label,
        toolName,
        toolCategory: entry.category,
        mutating: mutatingSet.has(toolName),
        position: {
          x: basePos.x + col * LAYOUT.toolColGapX,
          y: LAYOUT.toolRowY + rowOffset + row * LAYOUT.toolRowGapY,
        },
        stageCode: stageKey === "escalonamento" ? "escalonamento" : (stageKey as AgentPipelineStage),
      });
    });
  }

  return nodes;
}

export function buildStageTransitionEdges(): UnifiedGraphEdge[] {
  const edges = AGENT_PIPELINE_FLOW_EDGES.map((e, i) => ({
    id: `st-${i}`,
    from: `stage_${e.from}`,
    to: `stage_${e.to}`,
    kind:
      e.kind === "transversal"
        ? ("transversal" as const)
        : e.kind === "parallel"
          ? ("parallel" as const)
          : ("stage_transition" as const),
    label: e.label,
  }));

  // Reduz linhas transversais — só 3 entradas principais para escalonamento
  const transversalFrom = new Set(["captacao", "agendamento", "confirmacao_pre_consulta"]);
  return edges.filter(
    (e) => e.kind !== "transversal" || transversalFrom.has(e.from.replace("stage_", ""))
  );
}

export function buildResolverToStageEdges(): UnifiedGraphEdge[] {
  return [
    {
      id: "res-stage-entry",
      from: "runtime_resolver",
      to: "stage_identificacao",
      kind: "context",
      label: "entrada",
    },
    {
      id: "res-stage-bridge",
      from: "runtime_resolver",
      to: "stage_captacao",
      kind: "context",
      label: "resolve",
    },
  ];
}

export function buildStageToToolsHubEdges(): UnifiedGraphEdge[] {
  return [];
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

export function buildToolsHubToToolEdges(_expandedStages: Set<string>): UnifiedGraphEdge[] {
  return [];
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
  memory: ["rt-router-agent", "rt-agent-journey", "rt-journey-resolver", "rt-agent-resolver"],
  tools: ["rt-router-agent", "rt-agent-resolver", "rt-resolver-tools", "rt-tools-confirm"],
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
