import { filterFreshOfferedDays, filterFreshOfferedSlots } from "@/lib/booking-state";
import type { AiConversationState } from "./types";

const FRESH_BOOKING_PATTERNS = [
  /\b(quero|preciso|gostaria).{0,30}(agendar|marcar|marcação|marcaçao)\b/i,
  /\b(agendar|marcar)\s+(uma\s+)?(consulta|procedimento|exame|retorno)\b/i,
  /\bconsulta nova\b/i,
];

export function isFreshBookingRequest(messageText: string): boolean {
  const t = messageText.trim();
  if (!t) return false;
  return FRESH_BOOKING_PATTERNS.some((p) => p.test(t));
}

export function hasFreshOfferedBookingSelection(
  state: AiConversationState,
  timeZone?: string
): boolean {
  const days = timeZone
    ? filterFreshOfferedDays(state.offered_days ?? [], timeZone)
    : (state.offered_days ?? []);
  const slots = filterFreshOfferedSlots(state.offered_slots ?? []);
  return days.length > 0 || slots.length > 0;
}

/** Limpa estado stale de agendamento quando o paciente inicia um pedido novo. */
export function resetStaleBookingState(
  state: AiConversationState,
  opts?: { timeZone?: string }
): AiConversationState {
  const hasFreshOffered = hasFreshOfferedBookingSelection(state, opts?.timeZone);
  if (hasFreshOffered) return state;

  const next: AiConversationState = {
    ...state,
    intent: "booking",
    offered_days: undefined,
    offered_slots: undefined,
    pending_slot: undefined,
    last_display_message: undefined,
    last_slot_query: undefined,
    booking_step: state.procedure_id ? (state.doctor_id ? "day" : "doctor") : "procedure",
  };
  return next;
}

export function maybeResetBookingForFreshRequest(
  messageText: string,
  state: AiConversationState,
  detectedIntent: string,
  opts?: { timeZone?: string }
): AiConversationState {
  if (detectedIntent !== "booking" && !isFreshBookingRequest(messageText)) {
    return state;
  }
  if (!isFreshBookingRequest(messageText)) return state;
  if (hasFreshOfferedBookingSelection(state, opts?.timeZone)) return state;
  return resetStaleBookingState(state, opts);
}
