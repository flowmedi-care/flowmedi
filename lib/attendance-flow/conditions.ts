import type { GoalCondition, GoalEvaluationContext } from "./types";

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function buildEvalRoot(ctx: GoalEvaluationContext): Record<string, unknown> {
  const booking = ctx.aiState.booking;
  return {
    patient_id: ctx.aiState.patient_id,
    booking: typeof booking === "object" && booking ? booking : {},
    collected: ctx.collected,
    patient: ctx.patient ?? {},
    focused_appointment_id: ctx.aiState.focused_appointment_id,
    mutation: ctx.mutation_done ?? {},
  };
}

export function evaluateCondition(
  condition: GoalCondition,
  ctx: GoalEvaluationContext
): boolean {
  const root = buildEvalRoot(ctx);
  const value = getByPath(root, condition.field);

  switch (condition.operator) {
    case "exists":
      return value !== undefined && value !== null && value !== "";
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "lt":
      return Number(value) < Number(condition.value);
    case "gt":
      return Number(value) > Number(condition.value);
    default:
      return false;
  }
}

export function evaluateWhen(
  when: GoalCondition[] | undefined,
  ctx: GoalEvaluationContext
): boolean {
  if (!when?.length) return true;
  return when.every((c) => evaluateCondition(c, ctx));
}
