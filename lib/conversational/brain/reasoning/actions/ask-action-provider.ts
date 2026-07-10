import type { Goal } from "../../types/goal";
import type { Action } from "./action";
import type { DomainGraph } from "../../graph/domain-graph";
import type { StateGraph } from "../../graph/state-graph";
import { checkPreconditions } from "../../graph/traversal";

export interface ActionProvider {
  enumerate(state: StateGraph, goal: Goal, domain: DomainGraph): Action[];
}

export class AskActionProvider implements ActionProvider {
  constructor(private readonly actions: Action[]) {}

  enumerate(_state: StateGraph, _goal: Goal, _domain: DomainGraph): Action[] {
    return this.actions.filter((a) => a.kind === "ask");
  }
}

export class ToolActionProvider implements ActionProvider {
  constructor(private readonly actions: Action[]) {}

  enumerate(state: StateGraph, _goal: Goal, _domain: DomainGraph): Action[] {
    return this.actions
      .filter((a) => a.kind === "tool")
      .filter((a) => checkPreconditions(a.preconditions, state));
  }
}
