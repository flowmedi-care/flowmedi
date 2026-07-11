import type { GoalCompletion, GoalEvaluationContext } from "./types";

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function isSlotSelected(ctx: GoalEvaluationContext): boolean {
  const booking = ctx.aiState.booking as Record<string, unknown> | undefined;
  if (!booking) return false;
  if (booking.pending_slot) return true;
  const status = booking.status;
  if (status === "confirming" || status === "done") return true;
  return false;
}

const CUSTOM_RESOLVERS: Record<string, (ctx: GoalEvaluationContext) => boolean> = {
  slot_selected: isSlotSelected,
  "patient.is_first_visit": () => false,
};

export function isGoalSatisfied(
  completion: GoalCompletion,
  ctx: GoalEvaluationContext
): boolean {
  switch (completion.type) {
    case "state_path": {
      const val = getByPath(ctx.aiState as Record<string, unknown>, completion.path);
      return val !== undefined && val !== null && val !== "";
    }
    case "collected": {
      const val = ctx.collected[completion.key];
      return val !== undefined && val !== null && val !== "";
    }
    case "mutation": {
      return Boolean(ctx.mutation_done?.[completion.key]);
    }
    case "custom": {
      const fn = CUSTOM_RESOLVERS[completion.resolver];
      return fn ? fn(ctx) : false;
    }
    default:
      return false;
  }
}
