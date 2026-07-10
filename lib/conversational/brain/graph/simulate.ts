import type { Action } from "../reasoning/actions/action";
import type { DomainGraph } from "./domain-graph";
import { cloneStateGraph, recomputeSatisfiedNodes, type StateGraph } from "./state-graph";

export function simulateAction(
  action: Action,
  state: StateGraph,
  domain: DomainGraph
): StateGraph {
  let next = cloneStateGraph(state);
  for (const t of action.postconditions) {
    next.entities[t.entity] = {
      ...next.entities[t.entity],
      status: t.to,
      value: next.entities[t.entity]?.value,
      confidence: t.to === "known" ? 1 : next.entities[t.entity]?.confidence,
    };
  }
  next = recomputeSatisfiedNodes(next, domain);
  return next;
}
