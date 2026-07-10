import { isSlotSelectionMessage } from "@/lib/virtual-assistant/booking-slot-messages";
import type { AiState } from "./state/types";
import { mergeAiState, resolveOptionByIndex } from "./state/patch";

export type BookingContinuityPatch = {
  statePatch: Partial<AiState>;
  /** Contexto injetado na mensagem do usuário para o LLM */
  enrichedUserText?: string;
};

/**
 * Resolve seleções numéricas ("1", "2") contra listas oferecidas no ai_state.
 * Infra determinística — não faz parte do contrato de tool.
 */
export function applyBookingContinuity(
  userText: string,
  aiState: AiState
): BookingContinuityPatch {
  const trimmed = userText.trim();
  if (!trimmed) return { statePatch: {} };

  const isNumeric = /^\d{1,2}$/.test(trimmed);
  const isSelection = isSlotSelectionMessage(trimmed);

  if (!isSelection && !isNumeric) {
    return { statePatch: {} };
  }

  const patch: Partial<AiState> = {};
  let enrichedUserText: string | undefined;

  if (isNumeric || /^\d{1,2}$/.test(trimmed)) {
    const doctorPick = resolveOptionByIndex(aiState.offered_doctors, trimmed);
    if (doctorPick && !aiState.booking?.doctor_id) {
      patch.booking = {
        ...aiState.booking,
        doctor_id: doctorPick.id,
        status: aiState.booking?.status ?? "collecting",
      };
      enrichedUserText = `${trimmed} (seleção: médico "${doctorPick.name}", doctor_id=${doctorPick.id})`;
      return { statePatch: patch, enrichedUserText };
    }

    const procedurePick = resolveOptionByIndex(aiState.offered_procedures, trimmed);
    if (procedurePick && !aiState.booking?.procedure_id) {
      patch.booking = {
        ...aiState.booking,
        procedure_id: procedurePick.id,
        status: aiState.booking?.status ?? "collecting",
      };
      enrichedUserText = `${trimmed} (seleção: procedimento "${procedurePick.name}", procedure_id=${procedurePick.id})`;
      return { statePatch: patch, enrichedUserText };
    }

    const slots = aiState.booking?.offered_slots ?? [];
    if (slots.length > 0) {
      const index = Number(trimmed) - 1;
      const slot = slots[index];
      if (slot) {
        patch.booking = {
          ...aiState.booking,
          pending_slot: slot.scheduled_at,
          status: "confirming",
        };
        enrichedUserText = `${trimmed} (seleção: horário ${slot.display}, scheduled_at=${slot.scheduled_at})`;
        return { statePatch: patch, enrichedUserText };
      }
    }
  }

  return { statePatch: patch, enrichedUserText };
}

export function mergeBookingContinuity(
  aiState: AiState,
  continuity: BookingContinuityPatch
): AiState {
  if (!continuity.statePatch || Object.keys(continuity.statePatch).length === 0) {
    return aiState;
  }
  return mergeAiState(aiState, continuity.statePatch);
}
