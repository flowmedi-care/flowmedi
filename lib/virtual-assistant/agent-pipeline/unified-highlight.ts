import type { PipelineTrace, PipelineStep } from "@/lib/operational-agents/pipeline-trace";
import { PLAYBACK_STEPS } from "./flow-model";
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
  playbackNarrative: string | null;
};

export function resolveUnifiedPipelineHighlight(opts: {
  trace?: PipelineTrace | null;
  currentStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
  lastToolName?: string | null;
  playbackStepIndex?: number | null;
  playbackMode?: boolean;
}): UnifiedPipelineHighlight {
  const { trace, currentStage, parallelStages = [], lastToolName, playbackStepIndex, playbackMode } = opts;

  if (playbackMode && playbackStepIndex != null) {
    const step = PLAYBACK_STEPS[playbackStepIndex % PLAYBACK_STEPS.length]!;
    const edgeIds = step.edgeIds as readonly string[];
    return {
      activeRuntimeEdgeIds: [...edgeIds],
      activeRuntimeNodeIds: [...step.nodeIds],
      activeStageId: currentStage ?? null,
      activeStageNodeId: currentStage ? `stage_${currentStage}` : null,
      activeToolIds: lastToolName ? [`tool_${lastToolName}`] : [],
      activeParallelStageIds: parallelStages,
      activeEdgeIds: [...edgeIds],
      activeResolverEdgeId: edgeIds.includes("dyn-switch-stage") ? "dyn-switch-stage" : null,
      activeStageToHubEdgeId: edgeIds.includes("dyn-stage-tools") ? "dyn-stage-tools" : null,
      playbackNarrative: step.narrative,
    };
  }

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
    activeEdgeIds.push("dyn-switch-stage", "dyn-stage-tools");
  }
  for (const ps of parallelStages) {
    activeEdgeIds.push(`par-${ps}`);
  }

  return {
    activeRuntimeEdgeIds,
    activeRuntimeNodeIds,
    activeStageId: currentStage ?? null,
    activeStageNodeId,
    activeToolIds,
    activeParallelStageIds: parallelStages,
    activeEdgeIds,
    activeResolverEdgeId: activeStageNodeId ? "dyn-switch-stage" : null,
    activeStageToHubEdgeId: activeStageNodeId ? "dyn-stage-tools" : null,
    playbackNarrative: null,
  };
}

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
