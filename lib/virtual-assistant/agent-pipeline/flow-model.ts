import type { InboundIntent } from "../detect-inbound-intent";
import { AGENT_PIPELINE_FLOW_EDGES } from "./flow-graph";
import {
  AGENT_PIPELINE_STAGES,
  JOURNEY_STEP_TO_PIPELINE_STAGE,
  type AgentPipelineStage,
} from "./stages";

export type SwimlaneId = "execution" | "resolver" | "journey" | "parallel" | "exits";

export type TransitionTrigger =
  | { type: "journey_step"; steps: string[]; label: string }
  | { type: "intent"; intent: InboundIntent | InboundIntent[]; label: string }
  | { type: "ai_state"; field: string; condition: string; label: string }
  | { type: "tool_result"; tool: string; outcome: string; label: string }
  | { type: "human_action"; description: string; label: string }
  | { type: "timeout"; description: string; label: string };

export type ExecutionNodeDef = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  lane: SwimlaneId;
  laneOrder: number;
  runtimeIcon?:
    | "message"
    | "debounce"
    | "router"
    | "booking"
    | "agent"
    | "journey"
    | "tools"
    | "response"
    | "confirm"
    | "resolver"
    | "gate"
    | "execute"
    | "handoff"
    | "end";
  nodeKind?: "runtime" | "hub" | "switch" | "gate";
};

export type ExecutionEdgeDef = {
  id: string;
  from: string;
  to: string;
  label?: string;
  trigger?: TransitionTrigger;
  kind: "runtime" | "context" | "return" | "transversal" | "tool_filter";
};

export type ResolverSwitchRule = {
  id: string;
  priority: number;
  label: string;
  targetStage: AgentPipelineStage | "escalonamento";
  trigger: TransitionTrigger;
};

export type ParallelActivationRule = {
  stage: AgentPipelineStage;
  label: string;
  activatesWhen: string;
  trigger: TransitionTrigger;
  extraTools: string[];
};

export type ExitFlowRule = {
  id: string;
  label: string;
  trigger: string;
  targetNodeId: string;
  effect: string;
};

export type CrmTransitionDef = {
  id: string;
  from: AgentPipelineStage | "escalonamento";
  to: AgentPipelineStage | "escalonamento";
  label?: string;
  kind: "main" | "parallel" | "transversal";
  trigger: TransitionTrigger;
};

/** Lane 1 — execução por mensagem (18 nós) */
export const EXECUTION_NODES: ExecutionNodeDef[] = [
  { id: "runtime_msg", label: "Mensagem", shortLabel: "MSG", description: "Webhook WhatsApp inbound", lane: "execution", laneOrder: 0, runtimeIcon: "message" },
  { id: "runtime_debounce", label: "Debounce", shortLabel: "DEBOUNCE", description: "Aguarda mensagens agrupadas", lane: "execution", laneOrder: 1, runtimeIcon: "debounce" },
  { id: "runtime_detect_intent", label: "Detectar intent", shortLabel: "INTENT", description: "detectInboundIntent — regex pré-LLM", lane: "execution", laneOrder: 2, runtimeIcon: "router" },
  { id: "runtime_router", label: "Roteador", shortLabel: "ROUTER", description: "routeInboundFlow — booking/pricing/general", lane: "execution", laneOrder: 3, runtimeIcon: "router" },
  { id: "runtime_booking", label: "Booking Machine", shortLabel: "BOOKING", description: "Fluxo determinístico de agendamento", lane: "execution", laneOrder: 4, runtimeIcon: "booking" },
  { id: "runtime_escalate_gate", label: "Escalar?", shortLabel: "ESCALAR?", description: "shouldEscalateToHuman + shouldAutoHandoff", lane: "execution", laneOrder: 5, runtimeIcon: "gate", nodeKind: "gate" },
  { id: "runtime_agent", label: "Agente LLM", shortLabel: "AGENTE", description: "OpenAI function calling loop", lane: "execution", laneOrder: 6, runtimeIcon: "agent" },
  { id: "runtime_journey", label: "Jornada CRM", shortLabel: "JORNADA", description: "loadContactJourneyForAi", lane: "execution", laneOrder: 7, runtimeIcon: "journey" },
  { id: "runtime_resolver_switch", label: "Switch Resolver", shortLabel: "SWITCH", description: "resolveAgentPipelineStage — escolhe etapa", lane: "resolver", laneOrder: 0, runtimeIcon: "resolver", nodeKind: "switch" },
  { id: "runtime_tools_hub", label: "Tools filtradas", shortLabel: "TOOLS", description: "filterToolsForStage", lane: "execution", laneOrder: 8, runtimeIcon: "tools", nodeKind: "hub" },
  { id: "runtime_validate_tool", label: "Validar tool", shortLabel: "VALIDAR", description: "validateToolExecution + ordem obrigatória", lane: "execution", laneOrder: 9, runtimeIcon: "gate", nodeKind: "gate" },
  { id: "runtime_confirm_gate", label: "Confirmação", shortLabel: "CONFIRM", description: "requiresHumanConfirm — sim/não", lane: "execution", laneOrder: 10, runtimeIcon: "confirm", nodeKind: "gate" },
  { id: "runtime_execute_tool", label: "Executar tool", shortLabel: "EXEC", description: "executeAssistantTool", lane: "execution", laneOrder: 11, runtimeIcon: "execute" },
  { id: "runtime_response", label: "Resposta", shortLabel: "RESPOSTA", description: "send-reply WhatsApp", lane: "execution", laneOrder: 12, runtimeIcon: "response" },
  { id: "runtime_handoff", label: "Handoff", shortLabel: "HANDOFF", description: "transfer_to_human — fim IA", lane: "exits", laneOrder: 0, runtimeIcon: "handoff" },
  { id: "runtime_end", label: "Fim do ciclo", shortLabel: "FIM", description: "Aguarda próxima mensagem", lane: "exits", laneOrder: 1, runtimeIcon: "end" },
];

export const EXECUTION_EDGES: ExecutionEdgeDef[] = [
  { id: "ex-msg-debounce", from: "runtime_msg", to: "runtime_debounce", kind: "runtime" },
  { id: "ex-debounce-intent", from: "runtime_debounce", to: "runtime_detect_intent", kind: "runtime" },
  { id: "ex-intent-router", from: "runtime_detect_intent", to: "runtime_router", kind: "runtime", label: "intent detectado" },
  { id: "ex-router-booking", from: "runtime_router", to: "runtime_booking", kind: "runtime", label: "booking", trigger: { type: "intent", intent: ["booking", "reschedule"], label: "intent: booking" } },
  { id: "ex-router-escalate", from: "runtime_router", to: "runtime_escalate_gate", kind: "runtime" },
  { id: "ex-booking-agent", from: "runtime_booking", to: "runtime_agent", kind: "runtime" },
  { id: "ex-escalate-handoff", from: "runtime_escalate_gate", to: "runtime_handoff", kind: "transversal", label: "sim", trigger: { type: "human_action", description: "Reclamação, pedido humano, comprovante", label: "escalar" } },
  { id: "ex-escalate-agent", from: "runtime_escalate_gate", to: "runtime_agent", kind: "runtime", label: "não" },
  { id: "ex-agent-journey", from: "runtime_agent", to: "runtime_journey", kind: "context" },
  { id: "ex-journey-switch", from: "runtime_journey", to: "runtime_resolver_switch", kind: "context" },
  { id: "ex-switch-tools", from: "runtime_resolver_switch", to: "runtime_tools_hub", kind: "tool_filter", label: "etapa ativa" },
  { id: "ex-tools-validate", from: "runtime_tools_hub", to: "runtime_validate_tool", kind: "tool_filter" },
  { id: "ex-validate-confirm", from: "runtime_validate_tool", to: "runtime_confirm_gate", kind: "runtime" },
  { id: "ex-confirm-execute", from: "runtime_confirm_gate", to: "runtime_execute_tool", kind: "runtime", label: "auto" },
  { id: "ex-confirm-agent", from: "runtime_confirm_gate", to: "runtime_agent", kind: "return", label: "human_confirm" },
  { id: "ex-execute-agent", from: "runtime_execute_tool", to: "runtime_agent", kind: "return", label: "loop" },
  { id: "ex-agent-response", from: "runtime_agent", to: "runtime_response", kind: "return" },
  { id: "ex-response-end", from: "runtime_response", to: "runtime_end", kind: "runtime" },
  { id: "ex-handoff-end", from: "runtime_handoff", to: "runtime_end", kind: "transversal" },
];

/** Lane 2 — Switch resolver (9 regras priorizadas) */
export const RESOLVER_SWITCH_RULES: ResolverSwitchRule[] = [
  {
    id: "res-persisted",
    priority: 1,
    label: "pipeline_stage persistido",
    targetStage: "captacao",
    trigger: { type: "ai_state", field: "pipeline_stage", condition: "persistido + booking done → confirmação", label: "state: pipeline_stage" },
  },
  {
    id: "res-pending-confirm",
    priority: 2,
    label: "Confirmação pendente",
    targetStage: "confirmacao_pre_consulta",
    trigger: { type: "ai_state", field: "pending_confirmation_appointment_id", condition: "exists", label: "state: pending_confirmation" },
  },
  {
    id: "res-booking-step",
    priority: 3,
    label: "Booking ativo",
    targetStage: "agendamento",
    trigger: { type: "ai_state", field: "booking_step", condition: "!= done", label: "state: booking_step" },
  },
  {
    id: "res-last-appt",
    priority: 4,
    label: "Consulta recém-criada",
    targetStage: "confirmacao_pre_consulta",
    trigger: { type: "ai_state", field: "last_created_appointment_id", condition: "exists", label: "state: last_created_appointment" },
  },
  {
    id: "res-journey-sets",
    priority: 5,
    label: "Journey step sets",
    targetStage: "captacao",
    trigger: {
      type: "journey_step",
      steps: ["consulta_agendada", "orcamento_enviado", "consulta_realizada", "formulario_pendente", "pagamento_pendente"],
      label: "journey: step sets",
    },
  },
  {
    id: "res-journey-map",
    priority: 6,
    label: "JOURNEY_STEP_TO_PIPELINE_STAGE",
    targetStage: "captacao",
    trigger: { type: "journey_step", steps: Object.keys(JOURNEY_STEP_TO_PIPELINE_STAGE), label: "journey: mapped" },
  },
  {
    id: "res-intents",
    priority: 7,
    label: "Intent detectado",
    targetStage: "agendamento",
    trigger: {
      type: "intent",
      intent: ["payment", "form", "booking", "reschedule", "pricing", "quote", "my_appointments", "cancel"],
      label: "intent: *",
    },
  },
  {
    id: "res-no-patient",
    priority: 8,
    label: "Paciente não encontrado",
    targetStage: "identificacao",
    trigger: { type: "ai_state", field: "patient_id", condition: "missing", label: "state: no patient" },
  },
  {
    id: "res-default",
    priority: 9,
    label: "Default",
    targetStage: "captacao",
    trigger: { type: "ai_state", field: "patient_id", condition: "exists", label: "default: captacao" },
  },
];

export const PARALLEL_ACTIVATION_RULES: ParallelActivationRule[] = [
  {
    stage: "financeiro",
    label: "Financeiro (overlay)",
    activatesWhen: "intent=payment OU journey ∈ pagamento_* (main ≠ financeiro)",
    trigger: {
      type: "intent",
      intent: "payment",
      label: "intent: payment OR journey: pagamento_*",
    },
    extraTools: ["get_payment_status"],
  },
  {
    stage: "formularios",
    label: "Formulários (overlay)",
    activatesWhen: "intent=form OU journey=formulario_pendente (main ≠ formularios)",
    trigger: {
      type: "intent",
      intent: "form",
      label: "intent: form OR journey: formulario_pendente",
    },
    extraTools: ["get_form_status", "resend_form_link"],
  },
];

export const EXIT_FLOW_RULES: ExitFlowRule[] = [
  { id: "exit-handoff", label: "Handoff imediato", trigger: "shouldEscalateToHuman antes do agente", targetNodeId: "runtime_handoff", effect: "transfer_to_human, fim IA" },
  { id: "exit-escalate-stage", label: "Escalonamento por etapa", trigger: "Escalar de qualquer etapa main", targetNodeId: "stage_escalonamento", effect: "tool transfer_to_human" },
  { id: "exit-human-confirm", label: "Confirmação humana", trigger: "requiresHumanConfirm", targetNodeId: "runtime_confirm_gate", effect: "pausa loop, pergunta sim/não" },
  { id: "exit-tool-blocked", label: "Tool blocked 3x", trigger: "MAX_CONSECUTIVE_TOOL_FAILURES", targetNodeId: "runtime_handoff", effect: "escala para humano" },
  { id: "exit-response", label: "Resposta normal", trigger: "agent completa sem handoff", targetNodeId: "runtime_response", effect: "envia WhatsApp" },
  { id: "exit-loop", label: "Loop tool calls", trigger: "após execute tool", targetNodeId: "runtime_agent", effect: "volta ao agente (max 5–8 rounds)" },
];

function mapCrmTrigger(from: string, to: string, label?: string): TransitionTrigger {
  const key = `${from}->${to}:${label ?? ""}`;
  const maps: Record<string, TransitionTrigger> = {
    "identificacao->captacao:Não encontrado": { type: "ai_state", field: "patient_id", condition: "not found", label: "Paciente não encontrado" },
    "identificacao->confirmacao_pre_consulta:Consulta futura": { type: "journey_step", steps: ["consulta_agendada", "consulta_confirmada"], label: "Consulta futura" },
    "identificacao->orcamento:Orçamento pendente": { type: "journey_step", steps: ["orcamento_enviado", "orcamento_rascunho"], label: "Orçamento pendente" },
    "identificacao->pos_consulta:Consulta realizada": { type: "journey_step", steps: ["consulta_realizada"], label: "Consulta realizada" },
    "captacao->orcamento:Preço formal": { type: "intent", intent: ["pricing", "quote"], label: "Interesse em preço formal" },
    "captacao->agendamento:Quer agendar": { type: "intent", intent: "booking", label: "Quer agendar" },
    "orcamento->agendamento:Orçamento aceito": { type: "human_action", description: "Orçamento aceito pela clínica", label: "Orçamento aceito" },
    "orcamento->captacao:Sem resposta": { type: "timeout", description: "Sem resposta ao orçamento", label: "Sem resposta" },
    "agendamento->confirmacao_pre_consulta:Criado": { type: "tool_result", tool: "create_appointment", outcome: "success", label: "Agendamento criado" },
    "confirmacao_pre_consulta->pos_consulta:Realizada": { type: "journey_step", steps: ["consulta_realizada"], label: "Consulta realizada" },
    "confirmacao_pre_consulta->agendamento:Remarcar": { type: "intent", intent: "reschedule", label: "Remarcar" },
    "confirmacao_pre_consulta->captacao:Desistiu": { type: "tool_result", tool: "cancel_appointment", outcome: "dropped", label: "Desistiu" },
    "pos_consulta->agendamento:Retorno": { type: "journey_step", steps: ["retorno_sugerido"], label: "Retorno necessário" },
    "pos_consulta->satisfacao:NPS": { type: "journey_step", steps: ["pesquisa_nps_enviada"], label: "NPS" },
    "identificacao->financeiro:": { type: "intent", intent: "payment", label: "Consulta financeira" },
    "confirmacao_pre_consulta->formularios:": { type: "intent", intent: "form", label: "Formulário pendente" },
    "agendamento->formularios:": { type: "journey_step", steps: ["formulario_pendente"], label: "Formulário pendente" },
  };
  return maps[key] ?? { type: "human_action", description: label ?? `${from} → ${to}`, label: label ?? "transição" };
}

export const CRM_TRANSITIONS: CrmTransitionDef[] = AGENT_PIPELINE_FLOW_EDGES.filter(
  (e) => e.kind !== "transversal"
).map((e, i) => ({
  id: `crm-${i}`,
  from: e.from,
  to: e.to,
  label: e.label,
  kind: e.kind,
  trigger: mapCrmTrigger(e.from, e.to, e.label),
}));

export function getStageEntryTriggers(stage: AgentPipelineStage | "escalonamento"): ResolverSwitchRule[] {
  if (stage === "escalonamento") return [];
  return RESOLVER_SWITCH_RULES.filter((r) => {
    if (r.targetStage === stage) return true;
    if (r.id === "res-journey-map") {
      return Object.values(JOURNEY_STEP_TO_PIPELINE_STAGE).includes(stage);
    }
    if (r.id === "res-journey-sets") {
      const sets: Partial<Record<AgentPipelineStage, string[]>> = {
        confirmacao_pre_consulta: ["consulta_agendada", "consulta_confirmada"],
        orcamento: ["orcamento_enviado", "orcamento_rascunho"],
        pos_consulta: ["consulta_realizada"],
        formularios: ["formulario_pendente"],
        financeiro: ["pagamento_pendente", "pagamento_parcial", "pago"],
        satisfacao: ["pesquisa_nps_enviada"],
      };
      return sets[stage] !== undefined;
    }
    return false;
  });
}

export function getStageExitTransitions(stage: AgentPipelineStage | "escalonamento") {
  return CRM_TRANSITIONS.filter((t) => t.from === stage);
}

export function getStageInboundTransitions(stage: AgentPipelineStage | "escalonamento") {
  return CRM_TRANSITIONS.filter((t) => t.to === stage);
}

export function getRelatedParallelStages(stage: AgentPipelineStage): ParallelActivationRule[] {
  const links: Partial<Record<AgentPipelineStage, AgentPipelineStage[]>> = {
    identificacao: ["financeiro"],
    captacao: ["financeiro"],
    orcamento: ["financeiro"],
    agendamento: ["financeiro", "formularios"],
    confirmacao_pre_consulta: ["formularios"],
  };
  const codes = links[stage] ?? [];
  return PARALLEL_ACTIVATION_RULES.filter((r) => codes.includes(r.stage));
}

export function getStageDefinitionForPanel(stage: AgentPipelineStage | "escalonamento") {
  if (stage === "escalonamento") {
    return {
      code: "escalonamento" as const,
      label: "Transferir para humano",
      preconditions: ["Pedido explícito ou trigger de escalação"],
      exitConditions: ["Conversa atribuída à equipe humana"],
      readTools: [] as string[],
      mutatingTools: ["transfer_to_human"],
      requiredOrder: undefined as string[] | undefined,
    };
  }
  const def = AGENT_PIPELINE_STAGES.find((s) => s.code === stage)!;
  return {
    code: def.code,
    label: def.label,
    preconditions: def.preconditions,
    exitConditions: def.exitConditions,
    readTools: def.readTools,
    mutatingTools: def.mutatingTools,
    requiredOrder: def.requiredOrder,
  };
}

/** Playback passo a passo — sequência demo */
export const PLAYBACK_STEPS = [
  { id: "pb-1", nodeIds: ["runtime_msg", "runtime_debounce"], edgeIds: ["ex-msg-debounce"], narrative: "Mensagem WhatsApp chega e é agrupada (debounce)." },
  { id: "pb-2", nodeIds: ["runtime_detect_intent"], edgeIds: ["ex-debounce-intent", "ex-intent-router"], narrative: "Intent detectado por regex (ex: booking, pricing)." },
  { id: "pb-3", nodeIds: ["runtime_router", "runtime_booking"], edgeIds: ["ex-router-booking"], narrative: "Roteador envia para Booking Machine ou Agente." },
  { id: "pb-4", nodeIds: ["runtime_escalate_gate"], edgeIds: ["ex-router-escalate", "ex-escalate-agent"], narrative: "Gate de escalação — reclamação/humano desvia para handoff." },
  { id: "pb-5", nodeIds: ["runtime_agent", "runtime_journey"], edgeIds: ["ex-agent-journey"], narrative: "Agente carrega jornada CRM do contato." },
  { id: "pb-6", nodeIds: ["runtime_resolver_switch"], edgeIds: ["ex-journey-switch"], narrative: "Switch Resolver escolhe etapa ativa (prioridade 1→9)." },
  { id: "pb-7", nodeIds: ["runtime_tools_hub"], edgeIds: ["ex-switch-tools"], narrative: "filterToolsForStage libera subset de tools da etapa." },
  { id: "pb-8", nodeIds: ["runtime_validate_tool", "runtime_confirm_gate"], edgeIds: ["ex-tools-validate", "ex-validate-confirm"], narrative: "Validação + confirmação humana opcional por tool." },
  { id: "pb-9", nodeIds: ["runtime_execute_tool"], edgeIds: ["ex-confirm-execute", "ex-execute-agent"], narrative: "Tool executada — loop volta ao agente (max rounds)." },
  { id: "pb-10", nodeIds: ["runtime_response", "runtime_end"], edgeIds: ["ex-agent-response", "ex-response-end"], narrative: "Resposta enviada — fim do ciclo, aguarda próxima mensagem." },
] as const;

export const EXECUTION_NODE_COUNT = EXECUTION_NODES.length;
export const RESOLVER_SWITCH_OUTPUT_COUNT = RESOLVER_SWITCH_RULES.length;
export const CRM_TRANSITION_COUNT = CRM_TRANSITIONS.length;
export const PARALLEL_RULE_COUNT = PARALLEL_ACTIVATION_RULES.length;
export const EXIT_RULE_COUNT = EXIT_FLOW_RULES.length;
