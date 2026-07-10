import type { NormalizedFacts } from "../extractors/types";
import type { ToolResult } from "../tools/types";

export type ToolTraceEntry = {
  toolName: string;
  round: number;
  blocked: boolean;
  blockReason?: string;
  status: ToolResult["status"];
  durationMs: number;
};

export type TurnTrace = {
  conversationId: string;
  startedAt: string;
  userText: string;
  extractorsApplied: Partial<NormalizedFacts>;
  llmRounds: number;
  tools: ToolTraceEntry[];
  handoff: boolean;
  handoffReason?: string;
};

export function createTurnTrace(conversationId: string, userText: string): TurnTrace {
  return {
    conversationId,
    startedAt: new Date().toISOString(),
    userText: userText.slice(0, 200),
    extractorsApplied: {},
    llmRounds: 0,
    tools: [],
    handoff: false,
  };
}

export function logTurnTrace(trace: TurnTrace): void {
  if (process.env.NODE_ENV === "test") return;
  console.info("[chatbot:turn-trace]", JSON.stringify(trace));
}
