import type { ClinicConfig } from "../../clinic/clinic-config";
import type { Action } from "../reasoning/actions/action";
import type { DomainGraph } from "../graph/domain-graph";
import { addEdge, addNode, emptyDomainGraph } from "../graph/domain-graph";
import type { StateGraph } from "../graph/state-graph";
import { askAction, toolAction } from "./action-helpers";
import type { DomainPolicy } from "./domain-policy";

export class BookingPolicy implements DomainPolicy {
  readonly domain = "booking";

  contributeToGraph(graph: DomainGraph, _config: ClinicConfig): DomainGraph {
    let g = graph;
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

  registerActions(): Action[] {
    return [
      askAction("ask.date", "ask_date", "date"),
      {
        id: "ask.procedure",
        kind: "ask",
        preconditions: [],
        postconditions: [],
        cost: 0.1,
        latency: 0,
        risk: 0.05,
        reliability: 0.95,
        payload: { askType: "ask_procedure", entity: "procedure" },
      },
      askAction("ask.clarify.procedure", "clarify_procedure", "procedure", { from: "suspected" }),
      {
        id: "ask.confirm",
        kind: "ask",
        preconditions: [
          { entity: "procedure", from: "known", to: "known" },
          { entity: "patient", from: "known", to: "known" },
          { entity: "slot", from: "known", to: "known" },
        ],
        postconditions: [{ entity: "confirmation", from: "missing", to: "known" }],
        cost: 0.1,
        latency: 0,
        risk: 0.05,
        reliability: 0.95,
        payload: { askType: "confirm_booking", entity: "confirmation" },
      },
      askAction("ask.present_slots", "present_slots", "slot", { from: "suspected" }),
      toolAction("tool.listServices", "listServices", ["procedure"], [], {}, { cost: 0.7, reliability: 0.99 }),
      toolAction("tool.findPatient", "findPatient", ["patient"], [], {}, { cost: 0.3, reliability: 0.95 }),
      toolAction("tool.listSlots", "listSlots", ["slot"], ["procedure", "date"]),
      {
        id: "tool.createAppointment",
        kind: "tool",
        preconditions: [
          { entity: "procedure", from: "known", to: "known" },
          { entity: "patient", from: "known", to: "known" },
          { entity: "slot", from: "known", to: "known" },
          { entity: "confirmation", from: "known", to: "known" },
        ],
        postconditions: [{ entity: "appointment", from: "missing", to: "known" }],
        cost: 0.8,
        latency: 1,
        risk: 0.15,
        reliability: 0.99,
        payload: { tool: "createAppointment", args: {} },
      },
      {
        id: "finish.booking",
        kind: "finish",
        preconditions: [{ entity: "appointment", from: "known", to: "known" }],
        postconditions: [],
        cost: 0,
        latency: 0,
        risk: 0,
        reliability: 1,
        payload: { outcome: "booking_created" },
      },
    ];
  }

  normalizeObservation(
    entity: string,
    value: unknown,
    _state: StateGraph
  ): { status: "known" | "suspected"; value: unknown } {
    if (entity === "slot" && Array.isArray(value)) {
      return { status: "suspected", value };
    }
    return { status: "known", value };
  }
}
