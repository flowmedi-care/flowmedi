import type { Action } from "../reasoning/actions/action";
import type { DomainPolicy } from "./domain-policy";

function askAction(
  id: string,
  askType: string,
  entity: string,
  opts?: { from?: "missing" | "suspected" }
): Action {
  const from = opts?.from ?? "missing";
  return {
    id,
    kind: "ask",
    preconditions: from === "missing" ? [] : [{ entity, from, to: from }],
    postconditions: [{ entity, from, to: "known" }],
    cost: 0.1,
    latency: 0,
    risk: 0.05,
    reliability: 0.95,
    payload: { askType, entity },
  };
}

function toolAction(
  id: string,
  tool: string,
  produces: string[],
  requires: string[],
  args: Record<string, unknown> = {},
  opts?: { cost?: number; reliability?: number }
): Action {
  return {
    id,
    kind: "tool",
    preconditions: requires.map((entity) => ({
      entity,
      from: "known" as const,
      to: "known" as const,
    })),
    postconditions: produces.map((entity) => ({
      entity,
      from: "missing" as const,
      to: "known" as const,
    })),
    cost: opts?.cost ?? 0.5,
    latency: 0.5,
    risk: 0.1,
    reliability: opts?.reliability ?? 0.9,
    payload: { tool, args },
  };
}

export class BookingPolicy implements DomainPolicy {
  readonly domain = "booking";

  registerActions(): Action[] {
    return [
      askAction("ask.date", "ask_date", "date"),
      askAction("ask.procedure", "ask_procedure", "procedure"),
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
}

export class PricingPolicy implements DomainPolicy {
  readonly domain = "pricing";

  registerActions(): Action[] {
    return [
      askAction("ask.procedure.price", "ask_procedure", "procedure"),
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

export class CommonPolicy implements DomainPolicy {
  readonly domain = "common";

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

export function allPolicies(): DomainPolicy[] {
  return [new BookingPolicy(), new PricingPolicy(), new CommonPolicy()];
}

export function allActions(): Action[] {
  return allPolicies().flatMap((p) => p.registerActions());
}
