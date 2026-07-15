import type { NormalizedFacts } from "../extractors/types";
import type { AiState, OfferedOption } from "./types";
import { resolveOptionByIndex } from "./patch";
import {
  getValidOfferedSlots,
  hasValidPendingSlot,
  withPendingSlot,
  withSelectionFilters,
} from "./selection-context";

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
    patch.booking = withSelectionFilters(aiState.booking, {
      doctor_id: doctorPick.id,
    });
    return patch;
  }

  const procedurePick = resolveOptionByIndex(aiState.offered_procedures, idx);
  if (procedurePick && !aiState.booking?.procedure_id) {
    patch.booking = withSelectionFilters(aiState.booking, {
      procedure_id: procedurePick.id,
    });
    return patch;
  }

  const dayPick = resolveOptionByIndex(offeredDaysAsOptions(aiState.offered_days), idx);
  if (dayPick) {
    // Date change resets period so we do not keep a sticky tarde/manhã from prior search.
    patch.booking = withSelectionFilters(aiState.booking, {
      date: dayPick.id,
      period: null,
    });
    return patch;
  }

  const slots = getValidOfferedSlots(aiState.booking);
  if (slots.length > 0) {
    const slot = slots[facts.selectedIndex - 1];
    if (slot) {
      patch.booking = withPendingSlot(aiState.booking, slot.scheduled_at);
      return patch;
    }
  }

  // appointments[i] ↔ option i+1 — only when booking menus are not the active choice set.
  const bookingMenusActive =
    (aiState.offered_doctors?.length ?? 0) > 0 ||
    (aiState.offered_procedures?.length ?? 0) > 0 ||
    (aiState.offered_days?.length ?? 0) > 0 ||
    slots.length > 0;
  const activeAppts = aiState.active_appointments ?? [];
  if (!bookingMenusActive && activeAppts.length > 0) {
    const pick = activeAppts[facts.selectedIndex - 1];
    if (pick) {
      patch.focused_appointment_id = pick;
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
