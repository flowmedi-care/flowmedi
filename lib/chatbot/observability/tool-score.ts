import type { ToolTraceEntry } from "./turn-trace";
import type { ChatbotToolName } from "../tools/definitions";

export type ToolScoreEntry = {
  toolName: string;
  calls: number;
  success: number;
  needsInput: number;
  unavailable: number;
  notFound: number;
  error: number;
  blocked: number;
  retries: number;
  totalDurationMs: number;
};

export type ToolScoreReport = {
  totalCalls: number;
  byTool: Record<string, ToolScoreEntry>;
  handoffs: number;
};

function emptyEntry(toolName: string): ToolScoreEntry {
  return {
    toolName,
    calls: 0,
    success: 0,
    needsInput: 0,
    unavailable: 0,
    notFound: 0,
    error: 0,
    blocked: 0,
    retries: 0,
    totalDurationMs: 0,
  };
}

/** Aggregate tool trace entries from one or more turns. */
export function buildToolScore(
  traces: Array<{ tools: ToolTraceEntry[]; handoff: boolean }>
): ToolScoreReport {
  const byTool: Record<string, ToolScoreEntry> = {};
  let handoffs = 0;

  for (const trace of traces) {
    if (trace.handoff) handoffs++;
    const seenThisTurn = new Set<string>();

    for (const entry of trace.tools) {
      if (!byTool[entry.toolName]) {
        byTool[entry.toolName] = emptyEntry(entry.toolName);
      }
      const row = byTool[entry.toolName]!;
      row.calls++;
      row.totalDurationMs += entry.durationMs;

      if (entry.blocked) {
        row.blocked++;
        row.needsInput++;
      } else {
        switch (entry.status) {
          case "success":
            row.success++;
            break;
          case "needs_input":
            row.needsInput++;
            break;
          case "unavailable":
            row.unavailable++;
            break;
          case "not_found":
            row.notFound++;
            break;
          case "error":
            row.error++;
            break;
        }
      }

      if (seenThisTurn.has(entry.toolName)) {
        row.retries++;
      }
      seenThisTurn.add(entry.toolName);
    }
  }

  const totalCalls = Object.values(byTool).reduce((n, e) => n + e.calls, 0);
  return { totalCalls, byTool, handoffs };
}

export function formatToolScoreSummary(report: ToolScoreReport): string {
  const lines = [`Total tool calls: ${report.totalCalls}`, `Handoffs: ${report.handoffs}`];
  for (const entry of Object.values(report.byTool).sort((a, b) => b.calls - a.calls)) {
    lines.push(
      `${entry.toolName}: ${entry.calls} calls (ok=${entry.success} needs=${entry.needsInput} unavail=${entry.unavailable} not_found=${entry.notFound} err=${entry.error} blocked=${entry.blocked} retries=${entry.retries})`
    );
  }
  return lines.join("\n");
}

export const TRANSCRIPT_EVAL_TOOL_NAMES: ChatbotToolName[] = [
  "find_available_slots",
  "transfer_to_human",
  "create_appointment",
  "get_service_price",
  "search_faq",
];
