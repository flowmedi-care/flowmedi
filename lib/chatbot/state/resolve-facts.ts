import type { NormalizedFacts } from "../extractors/types";
import type { AiState, OfferedOption } from "./types";
import { resolveOptionByIndex } from "./patch";

function offeredDaysAsOptions(
  days: AiState["offered_days"]
): OfferedOption[] | undefined {
  return days?.map((d) => ({ id: d.date, name: d.label, index: d.index }));
}

/** Runtime: translate factual references into statePatch. Does not decide tools or flow. */
export function resolveReferenceFacts(
  facts: NormalizedFacts,
  aiState: AiState
): Partial<AiState> {
  const patch: Partial<AiState> = {};

  if (facts.selectedIndex != null) {
    const idx = String(facts.selectedIndex);
    const doctorPick = resolveOptionByIndex(aiState.offered_doctors, idx);
    if (doctorPick && !aiState.booking?.doctor_id) {
      patch.booking = {
        ...aiState.booking,
        doctor_id: doctorPick.id,
        status: aiState.booking?.status ?? "collecting",
      };
      return patch;
    }

    const procedurePick = resolveOptionByIndex(aiState.offered_procedures, idx);
    if (procedurePick && !aiState.booking?.procedure_id) {
      patch.booking = {
        ...aiState.booking,
        procedure_id: procedurePick.id,
        status: aiState.booking?.status ?? "collecting",
      };
      return patch;
    }

    const dayPick = resolveOptionByIndex(offeredDaysAsOptions(aiState.offered_days), idx);
    if (dayPick) {
      patch.booking = {
        ...aiState.booking,
        date: dayPick.id,
        status: aiState.booking?.status ?? "collecting",
      };
      return patch;
    }

    const slots = aiState.booking?.offered_slots ?? [];
    if (slots.length > 0) {
      const slot = slots[facts.selectedIndex - 1];
      if (slot) {
        patch.booking = {
          ...aiState.booking,
          pending_slot: slot.scheduled_at,
          status: "confirming",
        };
        return patch;
      }
    }
  }

  if (facts.date && !aiState.booking?.date) {
    const offered = aiState.offered_days?.find((d) => d.date === facts.date);
    patch.booking = {
      ...aiState.booking,
      date: offered?.date ?? facts.date,
      status: aiState.booking?.status ?? "collecting",
    };
  }

  return patch;
}
