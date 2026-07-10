import type { ConversationShadow } from "../types/memory";
import type { TurnPlan } from "../types/turn-plan";
import type { Understanding } from "../types/understanding";

export function deriveConversationShadow(
  plan: TurnPlan,
  understanding: Understanding
): ConversationShadow {
  let inferredPhase: ConversationShadow["inferredPhase"] = "idle";
  if (plan.handoff) inferredPhase = "handoff";
  else if (plan.primaryGoal === "confirm") inferredPhase = "confirming";
  else if (plan.toolSteps.length > 0 || plan.clarify) inferredPhase = "gathering";

  return {
    inferredPhase,
    inferredDomain: understanding.infoNeeds[0] ?? null,
    lastPlanGoal: plan.primaryGoal,
  };
}
