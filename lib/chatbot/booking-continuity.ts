/**
 * @deprecated Use extractors + resolveReferenceFacts + applySemanticFacts.
 */
import type { AiState } from "./state/types";
import { extractFacts } from "./extractors";
import { mergeAiState } from "./state/patch";
import { resolveReferenceFacts, applySemanticFacts } from "./state/resolve-facts";

export type BookingContinuityPatch = {
  statePatch: Partial<AiState>;
  enrichedUserText?: string;
};

/** @deprecated */
export function applyBookingContinuity(
  userText: string,
  aiState: AiState
): BookingContinuityPatch {
  const facts = extractFacts(userText, new Date(), aiState.booking?.offered_slots);
  const refPatch = resolveReferenceFacts(facts, aiState);
  const afterRef =
    Object.keys(refPatch).length > 0 ? mergeAiState(aiState, refPatch) : aiState;
  const semanticPatch = applySemanticFacts(facts, afterRef);
  const statePatch: Partial<AiState> = { ...refPatch };
  if (semanticPatch.booking) {
    statePatch.booking = { ...refPatch.booking, ...semanticPatch.booking };
  }
  return { statePatch };
}

/** @deprecated */
export function mergeBookingContinuity(
  aiState: AiState,
  continuity: BookingContinuityPatch
): AiState {
  if (!continuity.statePatch || Object.keys(continuity.statePatch).length === 0) {
    return aiState;
  }
  return mergeAiState(aiState, continuity.statePatch);
}
