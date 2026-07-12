import type { NormalizedFacts } from "../extractors/types";
import type { AiState, OfferedOption } from "./types";
import { resolveOptionByIndex } from "./patch";

function offeredDaysAsOptions(
  days: AiState["offered_days"]
): OfferedOption[] | undefined {
  return days?.map((d) => ({ id: d.date, name: d.label, index: d.index }));
}

/**
 * Resolves active references (menus) to domain entities via selectedIndex.
 * Produces a StatePatch only — does not mutate AiState, does not interpret semantics
 * (clock, names). See docs/contracts/reference-resolution.md.
 *
 * @deprecated name — prefer thinking of this as resolveReferences / applyReferenceSelections.
 */
export function resolveReferenceFacts(
  facts: NormalizedFacts & Record<string, unknown>,
  aiState: AiState
): Partial<AiState> {
  const patch: Partial<AiState> = {};

  if (facts.selectedIndex == null) {
    return patch;
  }

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

  return patch;
}

/**
 * Maps semantic extractor facts (clock, free-form date) into a StatePatch.
 * Does not compete with entities already set by reference resolution on the same turn.
 */
export function applySemanticFacts(
  facts: NormalizedFacts & Record<string, unknown>,
  aiState: AiState
): Partial<AiState> {
  const patch: Partial<AiState> = {};

  const scheduledAt = facts.selected_scheduled_at as string | undefined;
  if (scheduledAt && !aiState.booking?.pending_slot) {
    patch.booking = {
      ...aiState.booking,
      ...(patch.booking ?? {}),
      pending_slot: scheduledAt,
      status: "confirming",
    };
  }

  if (facts.date && !aiState.booking?.date && !patch.booking?.date) {
    const offered = aiState.offered_days?.find((d) => d.date === facts.date);
    patch.booking = {
      ...aiState.booking,
      ...(patch.booking ?? {}),
      date: offered?.date ?? facts.date,
      status: aiState.booking?.status ?? "collecting",
    };
  }

  return patch;
}
