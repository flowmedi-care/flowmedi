import type { PipelineTrace, PipelineStep } from "@/lib/operational-agents/pipeline-trace";
import type { AgentPipelineStage } from "./stages";
import { RUNTIME_PATH_MAP } from "./unified-flow-graph";

export type UnifiedPipelineHighlight = {
  activeRuntimeEdgeIds: string[];
  activeRuntimeNodeIds: string[];
  activeStageId: string | null;
  activeStageNodeId: string | null;
  activeToolIds: string[];
  activeParallelStageIds: AgentPipelineStage[];
  activeEdgeIds: string[];
};

export function resolveUnifiedPipelineHighlight(opts: {
  trace?: PipelineTrace | null;
  currentStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
  lastToolName?: string | null;
  expandedStages?: Set<string>;
}): UnifiedPipelineHighlight {
  const { trace, currentStage, parallelStages = [], lastToolName } = opts;

  const step: PipelineStep = trace?.isLive && trace ? trace.activeStep : "request";
  const activeRuntimeEdgeIds = RUNTIME_PATH_MAP[step] ?? RUNTIME_PATH_MAP.request ?? [];
  const activeRuntimeNodeIds = trace?.activeNodeIds?.map((id) => {
    const map: Record<string, string> = {
      A: "runtime_msg",
      Router: "runtime_router",
      C: "runtime_agent",
      B: "runtime_journey",
      D: "runtime_tools_hub",
    };
    return map[id] ?? id;
  }) ?? ["runtime_msg"];

  const activeStageNodeId = currentStage ? `stage_${currentStage}` : null;
  const activeToolIds = lastToolName ? [`tool_${lastToolName}`] : [];

  const activeEdgeIds = [...activeRuntimeEdgeIds];

  if (activeStageNodeId) {
    activeEdgeIds.push(`res-stage-${currentStage}`);
  }

  if (lastToolName) {
    activeEdgeIds.push(`hub-${ASSISTANT_TOOL_INDEX(lastToolName)}`);
  }

  return {
    activeRuntimeEdgeIds,
    activeRuntimeNodeIds,
    activeStageId: currentStage ?? null,
    activeStageNodeId,
    activeToolIds,
    activeParallelStageIds: parallelStages,
    activeEdgeIds,
  };
}

function ASSISTANT_TOOL_INDEX(toolName: string): number {
  const tools = [
    "lookup_patient_by_phone",
    "register_patient",
    "list_doctors",
    "list_procedures",
    "find_available_slots",
    "create_appointment",
    "list_patient_appointments",
    "confirm_appointment",
    "cancel_appointment",
    "get_procedure_info",
    "get_service_price",
    "list_price_options",
    "list_services",
    "get_contact_journey",
    "resolve_quote_offer",
    "create_and_send_quote",
    "get_quote_status",
    "get_form_status",
    "resend_form_link",
    "get_payment_status",
    "reschedule_appointment",
    "collect_nps_feedback",
    "transfer_to_human",
  ];
  return tools.indexOf(toolName);
}

/** Demo: ciclo de etapas CRM para animação */
export const DEMO_STAGE_CYCLE: AgentPipelineStage[] = [
  "identificacao",
  "captacao",
  "agendamento",
  "confirmacao_pre_consulta",
  "pos_consulta",
  "satisfacao",
];

export function getDemoStageForTick(tick: number): AgentPipelineStage {
  return DEMO_STAGE_CYCLE[tick % DEMO_STAGE_CYCLE.length]!;
}
