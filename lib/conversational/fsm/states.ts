export const FSM_STATES = [
  "idle",
  "consent.pending",
  "booking.collect_patient",
  "booking.collect_service",
  "booking.collect_professional",
  "booking.collect_datetime",
  "booking.confirm",
  "pricing.collect_service",
  "pricing.present",
  "faq.ask",
  "crm.collect_contact",
  "crm.collect_interest",
  "handoff.pending",
  "handoff.active",
  "closed",
] as const;

export type FsmState = (typeof FSM_STATES)[number];

export function isFsmState(value: string): value is FsmState {
  return (FSM_STATES as readonly string[]).includes(value);
}

export function handlerDomainFromState(state: FsmState): string | null {
  if (state === "idle" || state === "closed" || state === "consent.pending") {
    return state === "idle" ? "idle" : null;
  }
  const dot = state.indexOf(".");
  if (dot === -1) return null;
  return state.slice(0, dot);
}

export type HandlerDomain =
  | "idle"
  | "booking"
  | "pricing"
  | "faq"
  | "crm"
  | "handoff";

export function resolveHandlerDomain(state: FsmState): HandlerDomain | null {
  const domain = handlerDomainFromState(state);
  if (
    domain === "idle" ||
    domain === "booking" ||
    domain === "pricing" ||
    domain === "faq" ||
    domain === "crm" ||
    domain === "handoff"
  ) {
    return domain;
  }
  return null;
}
