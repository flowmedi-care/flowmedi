import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "../event-log";
import type { AiConversationState } from "../types";
import type { AgentPipelineStage } from "./stages";

export type PipelineTransitionTrigger =
  | "journey_step"
  | "tool_result"
  | "intent"
  | "booking_step"
  | "manual"
  | "initial"
  | "event_auto";

export function applyPipelineStageTransition(
  current: AiConversationState,
  toStage: AgentPipelineStage,
  trigger: PipelineTransitionTrigger
): Partial<AiConversationState> {
  if (current.pipeline_stage === toStage) return {};
  return {
    pipeline_stage: toStage,
    pipeline_stage_entered_at: new Date().toISOString(),
    pipeline_last_transition_trigger: trigger,
  };
}

export function logPipelineStageTransition(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    fromStage?: AgentPipelineStage | null;
    toStage: AgentPipelineStage;
    trigger: PipelineTransitionTrigger;
    journeyStepCode?: string;
  }
): void {
  if (opts.fromStage === opts.toStage) return;

  logAiEvent(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    stage: "pipeline_stage_enter",
    detail: {
      from_stage: opts.fromStage ?? null,
      to_stage: opts.toStage,
      trigger: opts.trigger,
      journey_step_code: opts.journeyStepCode ?? null,
    },
  });
}

export function logPipelineToolBlocked(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    toolName: string;
    stage: AgentPipelineStage;
    reason: string;
  }
): void {
  logAiEvent(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    stage: "pipeline_tool_blocked",
    level: "warn",
    detail: {
      tool_name: opts.toolName,
      pipeline_stage: opts.stage,
      reason: opts.reason,
    },
  });
}

export function logPipelineConfirmationPending(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    toolName: string;
    stage: AgentPipelineStage;
  }
): void {
  logAiEvent(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    stage: "pipeline_confirmation_pending",
    detail: {
      tool_name: opts.toolName,
      pipeline_stage: opts.stage,
    },
  });
}

export function incrementToolFailureCount(state: AiConversationState): Partial<AiConversationState> {
  return { consecutive_tool_failures: (state.consecutive_tool_failures ?? 0) + 1 };
}

export function resetToolFailureCount(): Partial<AiConversationState> {
  return { consecutive_tool_failures: 0 };
}
