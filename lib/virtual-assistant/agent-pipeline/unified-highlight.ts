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
  activeResolverEdgeId: string | null;
  activeStageToHubEdgeId: string | null;
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
  const activeRuntimeNodeIds =
    trace?.activeNodeIds?.map((id) => {
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
    activeEdgeIds.push("dyn-resolver-stage", "dyn-stage-tools");
  }

  for (const ps of parallelStages) {
    activeEdgeIds.push(`dyn-parallel-${ps}`);
  }

  if (lastToolName) {
    activeEdgeIds.push(`sf-${lastToolName}`);
  }

  return {
    activeRuntimeEdgeIds,
    activeRuntimeNodeIds,
    activeStageId: currentStage ?? null,
    activeStageNodeId,
    activeToolIds,
    activeParallelStageIds: parallelStages,
    activeEdgeIds,
    activeResolverEdgeId: activeStageNodeId ? "dyn-resolver-stage" : null,
    activeStageToHubEdgeId: activeStageNodeId ? "dyn-stage-tools" : null,
  };
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
