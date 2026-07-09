import {
  detectInboundIntent,
  type InboundIntent,
} from "../detect-inbound-intent";
import {
  hasActiveBookingContext,
  isDormantBookingState,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "../booking-continuity-guards";
import { clearDormantBookingOnIntentConflict } from "../booking-reset";
import type { AiConversationState } from "../types";
import type { AssistantRoute, ResolvedRoute, RouteSource } from "./types";

const MENU_BOOKING = /^\s*1\s*[!.?]*$/;
const MENU_DISCOVERY = /^\s*2\s*[!.?]*$/;
const MENU_HANDOFF = /^\s*3\s*[!.?]*$/;

function intentToRoute(intent: InboundIntent): AssistantRoute {
  switch (intent) {
    case "greeting":
      return "greeting";
    case "general":
      return "discovery";
    case "pricing":
    case "quote":
      return "pricing";
    case "booking":
    case "availability_check":
    case "reschedule":
      return "booking";
    case "human_handoff":
      return "handoff";
    case "cancel":
    case "my_appointments":
    case "payment":
    case "form":
    case "hours_location":
      return "agent";
    default:
      return "agent";
  }
}

function resolveMenuRoute(text: string): ResolvedRoute | null {
  if (MENU_BOOKING.test(text)) {
    return { route: "booking", intent: "booking", confidence: 0.99, source: "menu" };
  }
  if (MENU_DISCOVERY.test(text)) {
    return { route: "discovery", intent: "general", confidence: 0.99, source: "menu" };
  }
  if (MENU_HANDOFF.test(text)) {
    return { route: "handoff", intent: "human_handoff", confidence: 0.99, source: "menu" };
  }
  return null;
}

export function resolveAssistantRoute(input: {
  inboundText: string;
  aiState: AiConversationState;
}): { route: ResolvedRoute; aiState: AiConversationState } {
  const text = input.inboundText.trim();
  let aiState = { ...input.aiState };

  const regexIntent = detectInboundIntent(text, aiState);
  const continuityIntent = resolveContinuityIntent(text, aiState, regexIntent);

  if (shouldContinueBookingFlow(text, continuityIntent, aiState)) {
    const bookingIntent: InboundIntent =
      continuityIntent === "availability_check" ? "availability_check" : "booking";
    return {
      route: {
        route: "booking",
        intent: bookingIntent,
        confidence: 0.98,
        source: "continuity",
      },
      aiState: {
        ...aiState,
        intent: "booking",
        booking_step:
          aiState.booking_step ??
          ((aiState.offered_slots?.length ?? 0) > 0 ? "slot" : "day"),
      },
    };
  }

  const menuRoute = resolveMenuRoute(text);
  if (menuRoute) {
    aiState = clearDormantBookingOnIntentConflict(aiState, menuRoute.intent);
    if (menuRoute.route === "booking") {
      aiState = {
        ...aiState,
        intent: "booking",
        booking_step: aiState.booking_step ?? "procedure",
      };
    }
    return { route: menuRoute, aiState };
  }

  if (
    !isDormantBookingState(aiState) &&
    (hasActiveBookingContext(aiState) ||
      (aiState.booking_step && aiState.booking_step !== "done"))
  ) {
    return {
      route: {
        route: "booking",
        intent: regexIntent === "availability_check" ? "availability_check" : "booking",
        confidence: 0.95,
        source: "fsm",
      },
      aiState: { ...aiState, intent: "booking" },
    };
  }

  aiState = clearDormantBookingOnIntentConflict(aiState, regexIntent);

  if (regexIntent === "booking" || regexIntent === "availability_check") {
    aiState = {
      ...aiState,
      intent: "booking",
      booking_step: aiState.booking_step ?? "procedure",
    };
  }

  const confidence = regexIntent === "unknown" ? 0.4 : 0.95;

  return {
    route: {
      route: intentToRoute(regexIntent),
      intent: regexIntent,
      confidence,
      source: "regex",
    },
    aiState,
  };
}
