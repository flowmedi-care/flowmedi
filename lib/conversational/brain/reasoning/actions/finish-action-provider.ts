import type { Goal } from "../../types/goal";
import type { Action } from "./action";
import type { DomainGraph } from "../../graph/domain-graph";
import type { StateGraph } from "../../graph/state-graph";
import type { CostHeuristic } from "../../planning/remaining-cost";
import type { ActionProvider } from "./ask-action-provider";

export class FinishActionProvider implements ActionProvider {
  constructor(
    private readonly actions: Action[],
    private readonly heuristic: CostHeuristic
  ) {}

  enumerate(state: StateGraph, goal: Goal, domain: DomainGraph): Action[] {
    const remaining = this.heuristic.remainingCost(goal, domain, state);
    if (remaining > 0) return [];

    return this.actions.filter((a) => {
      if (a.kind !== "finish") return false;
      if (goal.type !== "chat" && a.id === "finish.chat") return false;
      if (goal.type !== "price" && a.id === "finish.price") return false;
      if (goal.type !== "booking" && a.id === "finish.booking") return false;
      return true;
    });
  }
}
