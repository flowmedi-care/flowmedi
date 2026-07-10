import type { FsmState } from "./states";
import type { HandlerOutcome } from "./side-effects";
import type { Intent } from "../domain/shared/intent";
import { firstStepForIntent } from "./idle-entry";

export function nextStateAfterReceive(
  current: FsmState,
  input: {
    interrupt: { type: string } | null;
    intent: Intent | null;
    confirmation: "yes" | "no" | null;
  }
): FsmState {
  if (input.interrupt?.type === "cancel" || input.interrupt?.type === "menu") {
    return "idle";
  }
  if (input.interrupt?.type === "handoff") {
    return "handoff.pending";
  }

  if (current === "consent.pending") {
    if (input.confirmation === "yes") return "idle";
    if (input.confirmation === "no") return "idle";
    return "consent.pending";
  }

  if (current === "idle" && input.intent) {
    const step = firstStepForIntent(input.intent);
    if (step && isFsmState(step)) return step;
    return current;
  }

  return current;
}

export function nextStateAfterOutcome(
  current: FsmState,
  outcome: HandlerOutcome["type"]
): FsmState {
  if (outcome === "complete") return "idle";

  const advanceMap: Partial<Record<FsmState, FsmState>> = {
    "booking.collect_patient": "booking.collect_service",
    "booking.collect_service": "booking.collect_datetime",
    "booking.collect_professional": "booking.collect_datetime",
    "booking.collect_datetime": "booking.confirm",
    "booking.confirm": "idle",
    "pricing.collect_service": "pricing.present",
    "pricing.present": "idle",
    "crm.collect_contact": "crm.collect_interest",
    "crm.collect_interest": "idle",
    "faq.ask": "idle",
    "handoff.pending": "handoff.active",
  };

  if (outcome === "advance") {
    return advanceMap[current] ?? current;
  }

  if (outcome === "fail") {
    return current;
  }

  return current;
}

function isFsmState(value: string): value is FsmState {
  return [
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
  ].includes(value);
}

export function consentPendingReply(): { skipHandler: true; reply: { mode: "template"; templateId: string } } {
  return {
    skipHandler: true,
    reply: { mode: "template", templateId: "consent.request" },
  };
}
