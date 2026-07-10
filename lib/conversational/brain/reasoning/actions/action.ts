import type { StateTransition } from "../../types/transition";

export type ActionKind = "ask" | "tool" | "finish" | "handoff";

export type ActionPayload =
  | { askType: string; entity?: string; context?: Record<string, unknown> }
  | { tool: string; args: Record<string, unknown> }
  | { outcome: string };

export type Action = {
  id: string;
  kind: ActionKind;
  preconditions: StateTransition[];
  postconditions: StateTransition[];
  cost: number;
  latency: number;
  risk: number;
  reliability: number;
  payload: ActionPayload;
};

export type Decision =
  | { type: "ASK"; action: Action }
  | { type: "TOOL"; action: Action }
  | { type: "FINISH"; action: Action };

export function actionToDecision(action: Action): Decision {
  if (action.kind === "tool") return { type: "TOOL", action };
  if (action.kind === "finish") return { type: "FINISH", action };
  return { type: "ASK", action };
}
