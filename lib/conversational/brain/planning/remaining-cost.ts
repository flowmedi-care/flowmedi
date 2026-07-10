import type { Goal } from "../types/goal";
import type { DomainGraph } from "../graph/domain-graph";
import type { StateGraph } from "../graph/state-graph";
import { minPathCost, unsatisfiedNodes } from "../graph/traversal";

export interface CostHeuristic {
  remainingCost(goal: Goal, domain: DomainGraph, state: StateGraph): number;
}

export class WeightedPathHeuristic implements CostHeuristic {
  remainingCost(goal: Goal, domain: DomainGraph, state: StateGraph): number {
    const missing = unsatisfiedNodes(domain, goal.desiredNode, state);
    return minPathCost(domain, goal.desiredNode, missing);
  }
}

export const defaultHeuristic = new WeightedPathHeuristic();
