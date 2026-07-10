import type { ScoredAction } from "../../planning/score-action";
import type { Action } from "../actions/action";
import type { Goal } from "../../types/goal";

export function explainReasoning(opts: {
  goal: Goal;
  remainingCost: number;
  unsatisfied: string[];
  chosenAction: Action;
  candidates: ScoredAction[];
}): string {
  const top = opts.candidates
    .slice(0, 3)
    .map((c) => `${c.action.id}:${c.score.toFixed(2)}`)
    .join(",");
  return [
    `goal=${opts.goal.type}:${opts.goal.desiredNode}`,
    `remainingCost=${opts.remainingCost}`,
    `unsatisfied=[${opts.unsatisfied.join(",")}]`,
    `chosen=${opts.chosenAction.id}`,
    top ? `top=[${top}]` : "",
  ]
    .filter(Boolean)
    .join("; ");
}
