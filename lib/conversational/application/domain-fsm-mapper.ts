import type { Conversation } from "../domain/conversation/conversation";
import type { BookingStep } from "../domain/booking/booking-step";
import type { FsmState } from "../fsm/states";
import { isFsmState } from "../fsm/states";

export function conversationToFsmState(conversation: Conversation): FsmState {
  const props = conversation.toProps();

  if (props.status === "closed") return "closed";
  if (props.status === "handoff") {
    return props.handoff ? "handoff.active" : "handoff.pending";
  }
  if (props.status === "awaiting_consent") return "consent.pending";
  if (props.status === "open" && !props.activeFlow) return "idle";

  const flow = props.activeFlow;
  if (!flow) return "idle";

  switch (flow.kind) {
    case "booking":
      return bookingStepToFsmState(flow.draft.step);
    case "pricing":
      return flow.draft.step === "select_service"
        ? "pricing.collect_service"
        : "pricing.present";
    case "faq":
      return "faq.ask";
    case "crm":
      return flow.draft.step === "collect_contact"
        ? "crm.collect_contact"
        : "crm.collect_interest";
    default:
      return "idle";
  }
}

function bookingStepToFsmState(step: BookingStep): FsmState {
  switch (step) {
    case "identify_patient":
      return "booking.collect_patient";
    case "select_service":
      return "booking.collect_service";
    case "select_professional":
      return "booking.collect_professional";
    case "select_datetime":
      return "booking.collect_datetime";
    case "confirm":
      return "booking.confirm";
    default:
      return "booking.collect_patient";
  }
}

export function fsmStateToConversationPatch(
  conversation: Conversation,
  nextState: FsmState
): void {
  if (nextState === "idle") {
    conversation.abortFlow();
    return;
  }
  if (nextState === "closed") {
    conversation.close();
    return;
  }
  if (nextState === "consent.pending") {
    return;
  }
  if (nextState === "handoff.pending" || nextState === "handoff.active") {
    if (nextState === "handoff.pending" && conversation.status !== "handoff") {
      conversation.enterHandoff(`pending-${conversation.id}`);
    }
    return;
  }

  const dot = nextState.indexOf(".");
  if (dot === -1) return;
  const domain = nextState.slice(0, dot);
  const step = nextState.slice(dot + 1);

  if (domain === "booking") {
    syncBookingFlow(conversation, step);
  } else if (domain === "pricing") {
    syncPricingFlow(conversation, step);
  } else if (domain === "faq") {
    if (conversation.activeFlow?.kind !== "faq") conversation.startFaq();
  } else if (domain === "crm") {
    syncCrmFlow(conversation, step);
  }
}

function syncBookingFlow(conversation: Conversation, step: string): void {
  const stepMap: Record<string, BookingStep> = {
    collect_patient: "identify_patient",
    collect_service: "select_service",
    collect_professional: "select_professional",
    collect_datetime: "select_datetime",
    confirm: "confirm",
  };
  const bookingStep = stepMap[step];
  if (!bookingStep) return;

  if (conversation.activeFlow?.kind === "booking") {
    conversation.advanceFlow({
      kind: "booking",
      draft: { ...conversation.activeFlow.draft, step: bookingStep },
    });
    return;
  }

  conversation.startBooking();
  const afterStart = conversation.toProps().activeFlow;
  if (afterStart?.kind === "booking") {
    conversation.advanceFlow({
      kind: "booking",
      draft: { ...afterStart.draft, step: bookingStep },
    });
  }
}

function syncPricingFlow(conversation: Conversation, step: string): void {
  if (conversation.activeFlow?.kind !== "pricing") {
    conversation.startPricing();
  }
  const flow = conversation.activeFlow;
  if (flow?.kind !== "pricing") return;
  conversation.advanceFlow({
    kind: "pricing",
    draft: {
      ...flow.draft,
      step: step === "present" ? "present_quote" : "select_service",
    },
  });
}

function syncCrmFlow(conversation: Conversation, step: string): void {
  if (conversation.activeFlow?.kind !== "crm") {
    conversation.startCrm();
  }
  const flow = conversation.activeFlow;
  if (flow?.kind !== "crm") return;
  conversation.advanceFlow({
    kind: "crm",
    draft: {
      ...flow.draft,
      step: step === "collect_interest" ? "collect_interest" : "collect_contact",
    },
  });
}

export function assertFsmState(value: string): FsmState {
  if (!isFsmState(value)) {
    throw new Error(`Invalid FSM state: ${value}`);
  }
  return value;
}
