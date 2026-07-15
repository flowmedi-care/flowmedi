import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "./types";
import {
  deriveActiveSelection,
  resolveActiveOptionByIndex,
} from "./active-selection";
import {
  getValidOfferedSlots,
  hasValidPendingSlot,
  withPendingSlot,
  withSelectionFilters,
} from "./selection-context";

/**
 * Resolves active references (menus) to domain entities via selectedIndex.
 * Produces a StatePatch only — does not mutate AiState, does not interpret semantics
 * (clock, names). See docs/contracts/reference-resolution.md.
 *
 * Index resolution belongs ONLY to active_selection (last menu the user received).
 */
export function resolveReferenceFacts(
  facts: NormalizedFacts & Record<string, unknown>,
  aiState: AiState
): Partial<AiState> {
  const patch: Partial<AiState> = {};

  if (facts.selectedIndex == null) {
    return patch;
  }

  const selection = deriveActiveSelection(aiState);
  const pick = resolveActiveOptionByIndex(selection, facts.selectedIndex);
  if (!selection || !pick) {
    return patch;
  }

  switch (selection.type) {
    case "doctor": {
      if (aiState.booking?.doctor_id) return patch;
      patch.booking = withSelectionFilters(aiState.booking, {
        doctor_id: pick.id,
      });
      return patch;
    }
    case "procedure": {
      if (aiState.booking?.procedure_id) return patch;
      patch.booking = withSelectionFilters(aiState.booking, {
        procedure_id: pick.id,
      });
      return patch;
    }
    case "day": {
      patch.booking = withSelectionFilters(aiState.booking, {
        date: pick.id,
        period: null,
      });
      return patch;
    }
    case "slot": {
      const slots = getValidOfferedSlots(aiState.booking);
      const slot =
        slots.find((s) => s.scheduled_at === pick.id) ??
        slots[facts.selectedIndex - 1];
      if (slot) {
        patch.booking = withPendingSlot(aiState.booking, slot.scheduled_at);
      }
      return patch;
    }
    case "appointment": {
      patch.focused_appointment_id = pick.id;
      return patch;
    }
    default:
      return patch;
  }
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

  const dateFact = typeof facts.date === "string" ? facts.date.trim() : "";
  const periodFact =
    facts.period === "manha" || facts.period === "tarde" ? facts.period : undefined;
  const hasPeriodFact = facts.period === "manha" || facts.period === "tarde";
  // "4 da tarde" / unmatched clock: period is a clock cue, not a search filter change.
  const periodIsClockCue =
    Boolean(facts.selected_scheduled_at) ||
    Boolean(facts.selected_hour) ||
    Boolean(facts.unresolved_hour) ||
    facts.time_unmatched === true;

  if (dateFact) {
    const currentDate = aiState.booking?.date?.trim();
    const offered = aiState.offered_days?.find((d) => d.date === dateFact);
    const nextDate = offered?.date ?? dateFact;
    const nextPeriod =
      hasPeriodFact && !periodIsClockCue ? periodFact! : null;
    if (nextDate !== currentDate || (hasPeriodFact && !periodIsClockCue)) {
      patch.booking = withSelectionFilters(aiState.booking, {
        date: nextDate,
        period: nextPeriod,
      });
    }
  } else if (hasPeriodFact && !periodIsClockCue) {
    patch.booking = withSelectionFilters(aiState.booking, {
      period: periodFact!,
    });
  }

  const scheduledAt = facts.selected_scheduled_at as string | undefined;
  const bookingAfter = patch.booking ?? aiState.booking;
  if (
    scheduledAt &&
    !hasValidPendingSlot(bookingAfter) &&
    getValidOfferedSlots(bookingAfter).some((s) => s.scheduled_at === scheduledAt)
  ) {
    patch.booking = withPendingSlot(bookingAfter, scheduledAt);
  } else if (scheduledAt && !hasValidPendingSlot(aiState.booking) && !patch.booking) {
    // Legacy path: match was against slots passed to extractors (still valid epoch).
    if (getValidOfferedSlots(aiState.booking).some((s) => s.scheduled_at === scheduledAt)) {
      patch.booking = withPendingSlot(aiState.booking, scheduledAt);
    }
  }

  return patch;
}
