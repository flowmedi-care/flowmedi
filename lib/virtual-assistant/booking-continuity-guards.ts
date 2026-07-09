import {
  detectInboundIntent,
  type InboundIntent,
} from "./detect-inbound-intent";
import { hasBookingSlotContext } from "./booking-day-context";
import { isFreshBookingRequest } from "./booking-reset";
import { isSlotSelectionMessage } from "./booking-slot-messages";
import type { AiConversationState } from "./types";

const EXPLICIT_NON_BOOKING_INTENTS = new Set<InboundIntent>([
  "pricing",
  "quote",
  "human_handoff",
  "cancel",
  "payment",
  "form",
  "my_appointments",
  "hours_location",
]);

/** Há contexto de agendamento em andamento (dias/horários oferecidos ou etapa ativa). */
export function hasActiveBookingContext(state: AiConversationState): boolean {
  if (state.last_created_appointment_id) return false;

  if (state.booking_step && state.booking_step !== "done") {
    if (state.procedure_id && state.doctor_id) return true;
    if ((state.offered_days?.length ?? 0) > 0 || (state.offered_slots?.length ?? 0) > 0) {
      return true;
    }
  }

  const hasOffered =
    (state.offered_days?.length ?? 0) > 0 || (state.offered_slots?.length ?? 0) > 0;
  const inLateStep =
    state.booking_step === "day" ||
    state.booking_step === "slot" ||
    state.booking_step === "confirm" ||
    state.booking_step === "patient";

  return hasOffered && inLateStep && Boolean(state.procedure_id && state.doctor_id);
}

export function hasOfferedBookingSelection(state: AiConversationState): boolean {
  const hasOffered =
    (state.offered_days?.length ?? 0) > 0 || (state.offered_slots?.length ?? 0) > 0;
  return hasOffered && Boolean(state.procedure_id && state.doctor_id);
}

export function shouldContinueBookingFlow(
  messageText: string,
  detectedIntent: InboundIntent,
  aiState: AiConversationState
): boolean {
  if (EXPLICIT_NON_BOOKING_INTENTS.has(detectedIntent)) return false;
  if (isFreshBookingRequest(messageText) && detectedIntent === "booking") return false;
  if (hasActiveBookingContext(aiState)) return true;
  if (!isSlotSelectionMessage(messageText)) return false;
  if (!aiState.procedure_id || !aiState.doctor_id) return false;
  return (
    hasOfferedBookingSelection(aiState) ||
    hasBookingSlotContext(aiState) ||
    Boolean(aiState.booking_step && aiState.booking_step !== "done")
  );
}

export function applyBookingContinuityStatePatch(
  aiState: AiConversationState
): AiConversationState {
  const bookingStep =
    aiState.booking_step ??
    ((aiState.offered_slots?.length ?? 0) > 0 ? "slot" : "day");

  return {
    ...aiState,
    intent: "booking",
    booking_step: bookingStep,
    pipeline_stage: "agendamento",
  };
}

export function resolveContinuityIntent(
  messageText: string,
  aiState: AiConversationState,
  detectedIntent: InboundIntent
): InboundIntent {
  if (!shouldContinueBookingFlow(messageText, detectedIntent, aiState)) {
    return detectedIntent;
  }
  const contextual = detectInboundIntent(messageText, aiState);
  if (contextual === "availability_check" || contextual === "booking") {
    return contextual;
  }
  return isSlotSelectionMessage(messageText) ? "availability_check" : "booking";
}
