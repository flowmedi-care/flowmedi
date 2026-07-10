import type { Action } from "../reasoning/actions/action";
import type { Goal } from "../types/goal";
import type { DomainGraph } from "../graph/domain-graph";
import { simulateAction } from "../graph/simulate";
import type { StateGraph } from "../graph/state-graph";
import { checkPreconditions } from "../graph/traversal";
import type { CostHeuristic } from "./remaining-cost";

export type ScoredAction = {
  action: Action;
  score: number;
  remainingCostAfter: number;
};

export function scoreAction(
  action: Action,
  goal: Goal,
  domain: DomainGraph,
  state: StateGraph,
  heuristic: CostHeuristic
): ScoredAction | null {
  if (!checkPreconditions(action.preconditions, state)) {
    return null;
  }

  const costBefore = heuristic.remainingCost(goal, domain, state);
  const stateAfter = simulateAction(action, state, domain);
  const costAfter = heuristic.remainingCost(goal, domain, stateAfter);
  const reduction = costBefore - costAfter;

  const score =
    reduction * 10 -
    action.cost -
    action.latency -
    action.risk -
    (1 - action.reliability);

  return { action, score, remainingCostAfter: costAfter };
}

export function chooseBestAction(scored: ScoredAction[]): Action | null {
  if (!scored.length) return null;
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return sorted[0]?.action ?? null;
}
