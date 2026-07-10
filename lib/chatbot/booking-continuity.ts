/**
 * @deprecated Use extractors + resolveReferenceFacts. Kept for backward compatibility in tests.
 */
import type { AiState } from "./state/types";
import { extractFacts } from "./extractors";
import { mergeAiState } from "./state/patch";
import { resolveReferenceFacts } from "./state/resolve-facts";

export type BookingContinuityPatch = {
  statePatch: Partial<AiState>;
  enrichedUserText?: string;
};

/** @deprecated */
export function applyBookingContinuity(
  userText: string,
  aiState: AiState
): BookingContinuityPatch {
  const facts = extractFacts(userText);
  const statePatch = resolveReferenceFacts(facts, aiState);
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
