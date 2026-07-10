import { addEdge, addNode, emptyDomainGraph, type DomainGraph } from "../domain-graph";

export function buildBookingGraph(): DomainGraph {
  let g = emptyDomainGraph();
  const nodes = [
    { name: "appointment.created", entity: "appointment" },
    { name: "confirmation", entity: "confirmation" },
    { name: "slot", entity: "slot" },
    { name: "date", entity: "date" },
    { name: "procedure", entity: "procedure" },
    { name: "patient", entity: "patient" },
  ];
  for (const n of nodes) g = addNode(g, n);

  const edges = [
    { from: "confirmation", to: "appointment.created", type: "requires" as const, weight: 3 },
    { from: "slot", to: "confirmation", type: "requires" as const, weight: 2 },
    { from: "procedure", to: "confirmation", type: "requires" as const, weight: 1 },
    { from: "patient", to: "confirmation", type: "requires" as const, weight: 1 },
    { from: "date", to: "slot", type: "requires" as const, weight: 2 },
    { from: "procedure", to: "slot", type: "belongsTo" as const, weight: 0 },
  ];
  for (const e of edges) g = addEdge(g, e);
  return g;
}

export function buildPricingGraph(): DomainGraph {
  let g = emptyDomainGraph();
  g = addNode(g, { name: "price.known", entity: "price" });
  g = addNode(g, { name: "procedure", entity: "procedure" });
  g = addEdge(g, { from: "procedure", to: "price.known", type: "requires", weight: 2 });
  return g;
}

export function buildCommonGraph(): DomainGraph {
  let g = emptyDomainGraph();
  g = addNode(g, { name: "chat.acknowledged", entity: "chat" });
  g = addNode(g, { name: "handoff.completed", entity: "handoff" });
  g = addNode(g, { name: "faq.answered", entity: "faq" });
  return g;
}

export function buildDomainGraph(): DomainGraph {
  let g = buildCommonGraph();
  const booking = buildBookingGraph();
  const pricing = buildPricingGraph();
  return {
    nodes: { ...g.nodes, ...booking.nodes, ...pricing.nodes },
    edges: [...g.edges, ...booking.edges, ...pricing.edges],
  };
}
