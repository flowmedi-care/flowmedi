import type { Action } from "../reasoning/actions/action";

export function askAction(
  id: string,
  askType: string,
  entity: string,
  opts?: { from?: "missing" | "suspected" }
): Action {
  const from = opts?.from ?? "missing";
  return {
    id,
    kind: "ask",
    preconditions: from === "missing" ? [] : [{ entity, from, to: from }],
    postconditions: [{ entity, from, to: "known" }],
    cost: 0.1,
    latency: 0,
    risk: 0.05,
    reliability: 0.95,
    payload: { askType, entity },
  };
}

export function toolAction(
  id: string,
  tool: string,
  produces: string[],
  requires: string[],
  args: Record<string, unknown> = {},
  opts?: { cost?: number; reliability?: number }
): Action {
  return {
    id,
    kind: "tool",
    preconditions: requires.map((entity) => ({
      entity,
      from: "known" as const,
      to: "known" as const,
    })),
    postconditions: produces.map((entity) => ({
      entity,
      from: "missing" as const,
      to: "known" as const,
    })),
    cost: opts?.cost ?? 0.5,
    latency: 0.5,
    risk: 0.1,
    reliability: opts?.reliability ?? 0.9,
    payload: { tool, args },
  };
}
