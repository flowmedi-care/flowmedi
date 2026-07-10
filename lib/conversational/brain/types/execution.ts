import type { ToolStep } from "./turn-plan";

export type StepResult = {
  stepId: string;
  tool: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type ExecutionBundle = {
  results: StepResult[];
  needsReplan: boolean;
  replanCount: number;
  retrievalChain: string[];
  facts: Record<string, unknown>;
};

export type ResolvedToolStep = ToolStep & {
  resolvedArgs: Record<string, unknown>;
};
