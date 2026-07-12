import type { MutationOutcome } from "../tools/mutation-result";
import type { ListExecutionTrace } from "@/lib/virtual-assistant/services/list-appointments-trace";

export type ExecutionTraceKind = "tool" | "extractor" | "snapshot_build";

export type ExecutionTrace = {
  kind: ExecutionTraceKind;
  name: string;
  outcome: MutationOutcome | "ok";
  duration_ms: number;
  retry_count?: number;
  db_rows_affected?: number;
  validation_gate?: string;
  executor?: string;
  /** @deprecated prefer snapshotBuiltAt */
  buildSequence?: number;
  snapshotBuiltAt?: string;
  snapshotBefore?: Record<string, unknown>;
  snapshotAfter?: Record<string, unknown>;
  detail?: string;
  /** Observability only — list_patient_appointments surgical replay. */
  listExecutionTrace?: ListExecutionTrace;
};

export function formatExecutionTrace(trace: ExecutionTrace): string {
  const parts = [
    `[${trace.kind}]`,
    trace.name,
    trace.outcome,
    `${trace.duration_ms}ms`,
  ];
  if (trace.snapshotBuiltAt) parts.push(`at=${trace.snapshotBuiltAt}`);
  else if (trace.buildSequence != null) parts.push(`seq=${trace.buildSequence}`);
  if (trace.detail) parts.push(trace.detail.slice(0, 120));
  return parts.join(" ");
}
