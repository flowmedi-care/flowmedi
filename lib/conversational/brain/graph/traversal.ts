import type { EntityStatus } from "../types/transition";
import type { DomainGraph } from "./domain-graph";
import type { StateGraph } from "./state-graph";

const DEPENDENCY_TYPES = new Set(["requires", "enables"]);

export function isNodeSatisfied(
  nodeName: string,
  state: StateGraph,
  domain: DomainGraph
): boolean {
  const node = domain.nodes[nodeName];
  if (!node?.entity) {
    return state.satisfiedNodes.has(nodeName);
  }
  const entity = state.entities[node.entity];
  return entity?.status === "known";
}

export function collectRequiredNodes(
  domain: DomainGraph,
  targetNode: string,
  visited = new Set<string>()
): string[] {
  if (visited.has(targetNode)) return [];
  visited.add(targetNode);

  const deps = domain.edges
    .filter((e) => e.to === targetNode && DEPENDENCY_TYPES.has(e.type))
    .map((e) => e.from);

  const nested = deps.flatMap((dep) => collectRequiredNodes(domain, dep, visited));
  return [...new Set([targetNode, ...deps, ...nested])];
}

export function unsatisfiedNodes(
  domain: DomainGraph,
  desiredNode: string,
  state: StateGraph
): string[] {
  const required = collectRequiredNodes(domain, desiredNode);
  return required.filter((node) => !isNodeSatisfied(node, state, domain));
}

export function reachableNodes(domain: DomainGraph, state: StateGraph): string[] {
  return Object.keys(domain.nodes).filter((name) => isNodeSatisfied(name, state, domain));
}

export function minPathCost(
  domain: DomainGraph,
  desiredNode: string,
  unsatisfied: string[]
): number {
  if (unsatisfied.length === 0) return 0;

  let total = 0;
  for (const node of unsatisfied) {
    const incoming = domain.edges.filter(
      (e) => e.from === node && DEPENDENCY_TYPES.has(e.type)
    );
    if (incoming.length > 0) {
      total += Math.min(...incoming.map((e) => e.weight));
    } else {
      const outgoing = domain.edges.find((e) => e.to === node && DEPENDENCY_TYPES.has(e.type));
      total += outgoing?.weight ?? 1;
    }
  }
  return total;
}

export function entityStatusForNode(
  nodeName: string,
  domain: DomainGraph,
  state: StateGraph
): EntityStatus {
  const node = domain.nodes[nodeName];
  if (!node?.entity) return "missing";
  return state.entities[node.entity]?.status ?? "missing";
}

export function checkPreconditions(
  preconditions: Array<{ entity: string; from: EntityStatus; to: EntityStatus }>,
  state: StateGraph
): boolean {
  return preconditions.every((p) => {
    const current = state.entities[p.entity]?.status ?? "missing";
    return current === p.from || (p.from === "suspected" && current === "suspected");
  });
}
