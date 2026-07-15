import type { ConversationSnapshot } from "../conversation-snapshot";
import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "../state/types";
import type { ToolResult } from "../tools/types";
import type { ExecutionTrace } from "./execution-trace";

export type SnapshotTraceLabel = "inbound" | "post_extractors" | "post_mutation";

export type SnapshotTraceSlice = {
  derived: {
    intakeGap: Array<{ goal_id: string; label: string; required: boolean }>;
    pendingGoals: string[];
    satisfiedGoals: string[];
    allowedTools: string[];
  };
  aiState: Pick<
    AiState,
    | "patient_id"
    | "booking"
    | "conversation_flow"
    | "active_selection"
    | "pending_active_selection"
    | "offered_doctors"
    | "offered_procedures"
    | "offered_days"
  >;
};

export type SnapshotTraceEntry = {
  label: SnapshotTraceLabel;
  snapshotBuiltAt: string;
  slice: SnapshotTraceSlice;
};

export type ToolTraceEntry = {
  toolName: string;
  round: number;
  blocked: boolean;
  blockReason?: string;
  status: ToolResult["status"];
  durationMs: number;
  resolvedArgs?: Record<string, unknown>;
  resultMessage?: string;
};

export type MutationGateTrace = {
  ok: boolean;
  missing?: string[];
  message?: string;
};

export type TurnTrace = {
  conversationId: string;
  startedAt: string;
  userText: string;
  extractorsApplied: Partial<NormalizedFacts>;
  snapshots: SnapshotTraceEntry[];
  allowedTools: string[];
  mutationGate?: MutationGateTrace;
  llmRounds: number;
  tools: ToolTraceEntry[];
  executionTraces: ExecutionTrace[];
  handoff: boolean;
  handoffReason?: string;
  replyDecision?: {
    source: string;
    reason: string;
    llmUsed: boolean;
  };
};

export function sliceSnapshotForTrace(snapshot: ConversationSnapshot): SnapshotTraceSlice {
  return {
    derived: {
      intakeGap: snapshot.derived.intakeGap.map((g) => ({
        goal_id: g.goal_id,
        label: g.label,
        required: g.required,
      })),
      pendingGoals: [...snapshot.derived.pendingGoals],
      satisfiedGoals: [...snapshot.derived.satisfiedGoals],
      allowedTools: [...snapshot.derived.allowedTools],
    },
    aiState: {
      patient_id: snapshot.aiState.patient_id,
      booking: snapshot.aiState.booking,
      conversation_flow: snapshot.aiState.conversation_flow,
      active_selection: snapshot.aiState.active_selection,
      pending_active_selection: snapshot.aiState.pending_active_selection,
      offered_doctors: snapshot.aiState.offered_doctors,
      offered_procedures: snapshot.aiState.offered_procedures,
      offered_days: snapshot.aiState.offered_days,
    },
  };
}

export function appendSnapshotTrace(
  trace: TurnTrace,
  label: SnapshotTraceLabel,
  snapshot: ConversationSnapshot
): void {
  trace.snapshots.push({
    label,
    snapshotBuiltAt: new Date().toISOString(),
    slice: sliceSnapshotForTrace(snapshot),
  });
}

export function createTurnTrace(conversationId: string, userText: string): TurnTrace {
  return {
    conversationId,
    startedAt: new Date().toISOString(),
    userText: userText.slice(0, 200),
    extractorsApplied: {},
    snapshots: [],
    allowedTools: [],
    llmRounds: 0,
    tools: [],
    executionTraces: [],
    handoff: false,
  };
}

export function serializeTurnTraceForEvent(trace: TurnTrace): Record<string, unknown> {
  const createAppointment = trace.tools.filter((t) => t.toolName === "create_appointment");
  const lastCreate = createAppointment[createAppointment.length - 1];

  return {
    userText: trace.userText,
    startedAt: trace.startedAt,
    extractorsApplied: trace.extractorsApplied,
    snapshots: trace.snapshots,
    allowedTools: trace.allowedTools,
    mutationGate: trace.mutationGate,
    tools: trace.tools,
    executionTraces: trace.executionTraces,
    llmRounds: trace.llmRounds,
    handoff: trace.handoff,
    handoffReason: trace.handoffReason,
    replyDecision: trace.replyDecision,
    toolsCount: trace.tools.length,
    hadBlockedTools: trace.tools.some((t) => t.blocked),
    createAppointmentOutcome: lastCreate
      ? {
          blocked: lastCreate.blocked,
          status: lastCreate.status,
          blockReason: lastCreate.blockReason,
          resultMessage: lastCreate.resultMessage,
        }
      : null,
  };
}

export function logTurnTrace(trace: TurnTrace): void {
  if (process.env.NODE_ENV === "test") return;
  console.info("[chatbot:turn-trace]", JSON.stringify(serializeTurnTraceForEvent(trace)));
}
