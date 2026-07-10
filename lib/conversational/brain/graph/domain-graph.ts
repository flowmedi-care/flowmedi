export type EdgeType =
  | "requires"
  | "produces"
  | "enables"
  | "conflictsWith"
  | "belongsTo"
  | "derivedFrom"
  | "invalidates";

export type DomainEdge = {
  from: string;
  to: string;
  type: EdgeType;
  weight: number;
};

export type DomainNode = {
  name: string;
  entity?: string;
};

export type DomainGraph = {
  nodes: Record<string, DomainNode>;
  edges: DomainEdge[];
};

export function emptyDomainGraph(): DomainGraph {
  return { nodes: {}, edges: [] };
}

export function addNode(graph: DomainGraph, node: DomainNode): DomainGraph {
  return {
    ...graph,
    nodes: { ...graph.nodes, [node.name]: node },
  };
}

export function addEdge(graph: DomainGraph, edge: DomainEdge): DomainGraph {
  return {
    ...graph,
    edges: [...graph.edges, edge],
  };
}

export function mergeGraphs(base: DomainGraph, patch: DomainGraph): DomainGraph {
  return {
    nodes: { ...base.nodes, ...patch.nodes },
    edges: [...base.edges, ...patch.edges],
  };
}
