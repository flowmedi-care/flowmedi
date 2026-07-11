import type { MutationOutcome } from "../tools/mutation-result";

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
  buildSequence?: number;
  detail?: string;
};

export function formatExecutionTrace(trace: ExecutionTrace): string {
  const parts = [
    `[${trace.kind}]`,
    trace.name,
    trace.outcome,
    `${trace.duration_ms}ms`,
  ];
  if (trace.buildSequence != null) parts.push(`seq=${trace.buildSequence}`);
  if (trace.detail) parts.push(trace.detail.slice(0, 120));
  return parts.join(" ");
}
