import type { Goal } from "../../types/goal";
import type { Action } from "./action";
import type { DomainGraph } from "../../graph/domain-graph";
import type { StateGraph } from "../../graph/state-graph";
import { allActions } from "../../policies/booking-policy";

export interface ActionProvider {
  enumerate(state: StateGraph, goal: Goal, domain: DomainGraph): Action[];
}

export class RegistryActionProvider implements ActionProvider {
  constructor(private readonly actions: Action[] = allActions()) {}

  enumerate(_state: StateGraph, _goal: Goal, _domain: DomainGraph): Action[] {
    return this.actions;
  }
}

export const defaultActionProvider = new RegistryActionProvider();
