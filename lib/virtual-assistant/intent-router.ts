import type { InboundIntent } from "./detect-inbound-intent";
import type { AiConversationState } from "./types";
import type { PromptFlow } from "./prompt/prompt-decision";

export type RoutedFlow = {
  flow: PromptFlow;
  intent: string;
  /** Se true, tentar booking-flow determinístico antes do agente */
  useBookingMachine: boolean;
};

export function routeInboundFlow(opts: {
  messageText: string;
  detectedIntent: InboundIntent;
  aiState: AiConversationState;
}): RoutedFlow {
  const { detectedIntent, aiState } = opts;

  if (aiState.booking_step && aiState.booking_step !== "done") {
    return { flow: "booking", intent: "booking", useBookingMachine: true };
  }

  if (aiState.last_created_appointment_id) {
    return { flow: "appointments", intent: "my_appointments", useBookingMachine: false };
  }

  switch (detectedIntent) {
    case "booking":
    case "availability_check":
    case "reschedule":
      return { flow: "booking", intent: "booking", useBookingMachine: true };
    case "pricing":
    case "quote":
      return { flow: "pricing", intent: "pricing", useBookingMachine: false };
    case "my_appointments":
    case "cancel":
      return { flow: "appointments", intent: "my_appointments", useBookingMachine: false };
    case "payment":
    case "form":
    case "hours_location":
    case "human_handoff":
    default:
      if (aiState.intent === "booking") {
        return { flow: "booking", intent: "booking", useBookingMachine: true };
      }
      if (aiState.intent === "pricing" || aiState.intent === "price") {
        return { flow: "pricing", intent: "pricing", useBookingMachine: false };
      }
      return { flow: "general", intent: detectedIntent === "unknown" ? "general" : detectedIntent, useBookingMachine: false };
  }
}
