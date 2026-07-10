import type { ClinicConfig } from "../../clinic/clinic-config";
import type { Action } from "../reasoning/actions/action";
import type { DomainGraph } from "../graph/domain-graph";
import { addEdge, addNode } from "../graph/domain-graph";
import { askAction, toolAction } from "./action-helpers";
import type { DomainPolicy } from "./domain-policy";

export class PricingPolicy implements DomainPolicy {
  readonly domain = "pricing";

  contributeToGraph(graph: DomainGraph, _config: ClinicConfig): DomainGraph {
    let g = addNode(graph, { name: "price.known", entity: "price" });
    if (!g.nodes.procedure) {
      g = addNode(g, { name: "procedure", entity: "procedure" });
    }
    return addEdge(g, {
      from: "procedure",
      to: "price.known",
      type: "requires",
      weight: 2,
    });
  }

  registerActions(): Action[] {
    return [
      {
        id: "ask.procedure.price",
        kind: "ask",
        preconditions: [],
        postconditions: [],
        cost: 0.1,
        latency: 0,
        risk: 0.05,
        reliability: 0.95,
        payload: { askType: "ask_procedure", entity: "procedure" },
      },
      toolAction("tool.listServices.price", "listServices", ["procedure"], [], {}, { cost: 0.7 }),
      toolAction("tool.getPriceQuote", "getPriceQuote", ["price"], ["procedure"]),
      {
        id: "finish.price",
        kind: "finish",
        preconditions: [{ entity: "price", from: "known", to: "known" }],
        postconditions: [],
        cost: 0,
        latency: 0,
        risk: 0,
        reliability: 1,
        payload: { outcome: "price_known" },
      },
    ];
  }
}
