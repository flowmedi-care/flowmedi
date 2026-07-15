/**
 * Shared domain mutation result shape.
 * Check-in adopts first; create/cancel/reschedule may migrate later.
 */
export type DomainMutationNotAllowedReason =
  | "DISABLED"
  | "TOO_EARLY"
  | "WINDOW_CLOSED"
  | "NOT_ELIGIBLE";

export type DomainMutationResult<TSuccess> =
  | { type: "SUCCESS"; data: TSuccess }
  | { type: "ALREADY_DONE"; data?: TSuccess }
  | {
      type: "NOT_ALLOWED";
      reason: DomainMutationNotAllowedReason;
      nextEligibleAt?: string;
    }
  | { type: "NOT_FOUND" };
