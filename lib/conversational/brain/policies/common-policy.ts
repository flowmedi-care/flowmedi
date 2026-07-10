import type { ClinicConfig } from "../../clinic/clinic-config";
import type { Action } from "../reasoning/actions/action";
import type { DomainGraph } from "../graph/domain-graph";
import { addNode } from "../graph/domain-graph";
import { toolAction } from "./action-helpers";
import type { DomainPolicy } from "./domain-policy";

export class CommonPolicy implements DomainPolicy {
  readonly domain = "common";

  contributeToGraph(graph: DomainGraph, _config: ClinicConfig): DomainGraph {
    let g = graph;
    g = addNode(g, { name: "chat.acknowledged", entity: "chat" });
    g = addNode(g, { name: "handoff.completed", entity: "handoff" });
    g = addNode(g, { name: "faq.answered", entity: "faq" });
    return g;
  }

  registerActions(): Action[] {
    return [
      {
        id: "ask.greet",
        kind: "ask",
        preconditions: [],
        postconditions: [{ entity: "chat", from: "missing", to: "known" }],
        cost: 0.05,
        latency: 0,
        risk: 0,
        reliability: 1,
        payload: { askType: "greet" },
      },
      toolAction("tool.searchFaq", "searchFaq", ["faq"], []),
      toolAction("tool.openHandoff", "openHandoffTicket", ["handoff"], []),
      {
        id: "finish.chat",
        kind: "finish",
        preconditions: [],
        postconditions: [{ entity: "chat", from: "missing", to: "known" }],
        cost: 0,
        latency: 0,
        risk: 0,
        reliability: 1,
        payload: { outcome: "chat_done" },
      },
    ];
  }
}
