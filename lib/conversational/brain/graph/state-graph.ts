import type { EntityStatus } from "../types/transition";
import type { DomainGraph } from "./domain-graph";
import { isNodeSatisfied } from "./traversal";

export type StateEntity = {
  status: EntityStatus;
  value?: unknown;
  confidence?: number;
};

export type Conflict = {
  entity: string;
  type: string;
  detail: string;
};

export type StateGraph = {
  entities: Record<string, StateEntity>;
  satisfiedNodes: Set<string>;
  conflicts: Conflict[];
  context: Record<string, unknown>;
};

export function emptyStateGraph(): StateGraph {
  return {
    entities: {},
    satisfiedNodes: new Set(),
    conflicts: [],
    context: {},
  };
}

export function cloneStateGraph(state: StateGraph): StateGraph {
  return {
    entities: { ...state.entities },
    satisfiedNodes: new Set(state.satisfiedNodes),
    conflicts: [...state.conflicts],
    context: { ...state.context },
  };
}

export function setEntity(
  state: StateGraph,
  entity: string,
  patch: Partial<StateEntity>
): StateGraph {
  const next = cloneStateGraph(state);
  next.entities[entity] = { ...next.entities[entity], ...patch };
  return next;
}

export function recomputeSatisfiedNodes(
  state: StateGraph,
  domain: DomainGraph
): StateGraph {
  const next = cloneStateGraph(state);
  next.satisfiedNodes = new Set(
    Object.keys(domain.nodes).filter((name) => isNodeSatisfied(name, state, domain))
  );
  return next;
}
