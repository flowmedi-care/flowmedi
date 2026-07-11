import type { EngineInput } from "@/lib/attendance-flow/engine";
import { reevaluateGoals } from "@/lib/attendance-flow/engine";

export { isGoalValueSatisfied, resolveGoalValue } from "@/lib/attendance-flow/data-resolver";

export function evaluateGoalsFromEngine(input: EngineInput): {
  satisfied: string[];
  pending: string[];
} {
  return reevaluateGoals(input);
}
