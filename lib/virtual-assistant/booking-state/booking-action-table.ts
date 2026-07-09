import { filterFreshOfferedDays, filterFreshOfferedSlots } from "@/lib/booking-state";
import { isSlotSelectionMessage } from "@/lib/virtual-assistant/booking-slot-messages";
import { isFreshBookingRequest } from "@/lib/virtual-assistant/booking-reset";
import type { InboundIntent } from "@/lib/virtual-assistant/detect-inbound-intent";
import type { AiConversationState, BookingStep } from "@/lib/virtual-assistant/types";

export type BookingAction =
  | { type: "execute_slot_selection" }
  | { type: "invalid_slot_reply" }
  | { type: "list_procedures" }
  | { type: "list_doctors" }
  | { type: "fetch_days" }
  | { type: "fetch_slots_for_day" }
  | { type: "bootstrap_patient" }
  | { type: "compose_guidance"; reason: string }
  | { type: "reset_booking" }
  | { type: "noop" };

const RESET_PATTERNS = [
  /\b(cancelar|desistir|parar|esquece|deixa)\b/i,
  /\b(recomeçar|recomecar|começar de novo|comecar de novo)\b/i,
];

function hasFreshOfferedSlots(state: AiConversationState, timeZone?: string): boolean {
  const slots = timeZone
    ? filterFreshOfferedSlots(state.offered_slots ?? [])
    : (state.offered_slots ?? []);
  const days = timeZone
    ? filterFreshOfferedDays(state.offered_days ?? [], timeZone)
    : (state.offered_days ?? []);
  return slots.length > 0 || days.length > 0;
}

/** Bloqueia refetch/tool_loop quando há lista ativa de horários/dias. */
export function shouldBlockBookingToolLoop(
  state: AiConversationState,
  opts?: { timeZone?: string }
): boolean {
  return hasFreshOfferedSlots(state, opts?.timeZone);
}

export function resolveBookingAction(input: {
  aiState: AiConversationState;
  inboundText: string;
  detectedIntent: InboundIntent;
  slotSelectionHandled?: boolean;
  timeZone?: string;
}): BookingAction {
  const { aiState, inboundText, detectedIntent, slotSelectionHandled, timeZone } = input;
  const text = inboundText.trim();
  const offeredSlots = filterFreshOfferedSlots(aiState.offered_slots ?? []);
  const offeredDays = timeZone
    ? filterFreshOfferedDays(aiState.offered_days ?? [], timeZone)
    : (aiState.offered_days ?? []);

  if (RESET_PATTERNS.some((p) => p.test(text)) || isFreshBookingRequest(text)) {
    if (isFreshBookingRequest(text) && !hasFreshOfferedSlots(aiState, timeZone)) {
      return { type: "reset_booking" };
    }
    if (RESET_PATTERNS.some((p) => p.test(text))) {
      return { type: "reset_booking" };
    }
  }

  if (offeredSlots.length > 0) {
    if (slotSelectionHandled) {
      return { type: "noop" };
    }
    if (isSlotSelectionMessage(text)) {
      return { type: "invalid_slot_reply" };
    }
    return {
      type: "compose_guidance",
      reason: "Escolha um número ou horário da lista que enviei.",
    };
  }

  const step: BookingStep = aiState.booking_step ?? "procedure";

  if (!aiState.procedure_id) {
    return { type: "list_procedures" };
  }
  if (!aiState.doctor_id) {
    return { type: "list_doctors" };
  }
  if (offeredDays.length > 0 && isSlotSelectionMessage(text)) {
    return { type: "execute_slot_selection" };
  }
  if (step === "day" || step === "slot" || detectedIntent === "availability_check") {
    if (offeredDays.length === 0 && !aiState.last_slot_query?.date) {
      return { type: "fetch_days" };
    }
    if (isSlotSelectionMessage(text) || detectedIntent === "availability_check") {
      return { type: "fetch_slots_for_day" };
    }
  }
  if (step === "patient" && !aiState.patient_id) {
    return { type: "bootstrap_patient" };
  }

  return { type: "noop" };
}

export function bookingGuidanceReply(reason: string): string {
  return reason;
}
