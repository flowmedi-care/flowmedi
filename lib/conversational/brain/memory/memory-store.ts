import type { Conversation } from "../../domain/conversation/conversation";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ExecutionBundle } from "../types/execution";
import type { ConversationShadow, OperationalMemory } from "../types/memory";
import { initialOperationalMemory } from "../types/memory";
import type { TurnPlan } from "../types/turn-plan";
import type { Understanding } from "../types/understanding";
import { defaultMenuShown } from "../understanding/understanding-layer";
import { deriveConversationShadow } from "./conversation-shadow";

export type BrainV2State = {
  operational: OperationalMemory;
  shadow: ConversationShadow;
};

export function readBrainV2State(aiState?: AiConversationState): BrainV2State {
  const raw = (aiState as AiConversationState & { brain_v2?: BrainV2State & { episode?: unknown } })
    ?.brain_v2;
  return {
    operational: { ...initialOperationalMemory(), ...raw?.operational },
    shadow: raw?.shadow ?? {
      inferredPhase: "idle",
      inferredDomain: null,
      lastPlanGoal: null,
    },
  };
}

export class MemoryStore {
  applyAfterTurn(opts: {
    conversation: Conversation;
    understanding: Understanding;
    plan: TurnPlan;
    bundle: ExecutionBundle;
    previous: OperationalMemory;
  }): BrainV2State {
    const { understanding, plan, bundle, previous } = opts;

    const operational: OperationalMemory = {
      ...previous,
      activeGoal: plan.subGoals[0] ?? plan.primaryGoal,
      awaiting: plan.clarify ? "question" : null,
      retrievalAttempts: bundle.needsReplan ? previous.retrievalAttempts + 1 : 0,
      frustrationScore:
        understanding.sentiment === "frustrated"
          ? previous.frustrationScore + 1
          : Math.max(0, previous.frustrationScore - 1),
      lastMenuShown:
        plan.primaryGoal === "greet" ? defaultMenuShown() : previous.lastMenuShown,
      stateEntities: previous.stateEntities ?? {},
    };

    const matchId = bundle.facts.matchId as string | undefined;
    if (matchId) {
      operational.selections = { ...operational.selections, serviceId: matchId };
    }

    const shadow = deriveConversationShadow(plan, understanding);

    return { operational, shadow };
  }

  toAiStatePatch(brain: BrainV2State): Partial<AiConversationState> {
    return { brain_v2: brain } as Partial<AiConversationState>;
  }
}
