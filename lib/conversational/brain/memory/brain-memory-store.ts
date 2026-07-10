import type { Conversation } from "../../domain/conversation/conversation";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ReasoningState } from "../reasoning/reasoner";
import type { ConversationShadow, OperationalMemory } from "../types/memory";
import { initialOperationalMemory } from "../types/memory";
import type { Episode, EpisodeTurn } from "../types/episode";
import { defaultMenuShown } from "../understanding/menu-reference-resolver";

export type BrainV2State = {
  operational: OperationalMemory;
  shadow: ConversationShadow;
  episode?: Episode;
};

export function readBrainV2State(aiState?: AiConversationState): BrainV2State {
  const raw = (aiState as AiConversationState & { brain_v2?: BrainV2State })?.brain_v2;
  return {
    operational: { ...initialOperationalMemory(), ...raw?.operational },
    shadow: raw?.shadow ?? {
      inferredPhase: "idle",
      inferredDomain: null,
      lastPlanGoal: null,
    },
    episode: raw?.episode,
  };
}

export class BrainMemoryStore {
  applyAfterTurn(opts: {
    conversation: Conversation;
    reasoning: ReasoningState;
    toolFacts: Record<string, unknown>;
    episodeTurn: EpisodeTurn;
    previous: OperationalMemory;
    previousEpisode?: Episode;
  }): BrainV2State {
    const { reasoning, toolFacts, episodeTurn, previous, previousEpisode } = opts;

    const operational: OperationalMemory = {
      ...previous,
      activeGoal: reasoning.goal.type,
      activeGoalData: reasoning.goal,
      stateEntities: { ...reasoning.state.entities },
      awaiting: reasoning.chosenAction.kind === "ask" ? "question" : null,
      retrievalAttempts: 0,
      frustrationScore: previous.frustrationScore,
      lastMenuShown:
        reasoning.goal.type === "chat" ? defaultMenuShown() : previous.lastMenuShown,
      selections: { ...previous.selections },
    };

    const matchId = toolFacts.matchId as string | undefined;
    if (matchId) {
      operational.selections = { ...operational.selections, serviceId: matchId };
    }

    const patientId = toolFacts.patient as string | undefined;
    if (patientId) {
      operational.selections = { ...operational.selections, patientId: String(patientId) };
    }

    const shadow: ConversationShadow = {
      inferredPhase:
        reasoning.unsatisfied.length > 0
          ? "gathering"
          : reasoning.goal.type === "booking"
            ? "confirming"
            : "idle",
      inferredDomain: reasoning.goal.type,
      lastPlanGoal: reasoning.goal.type,
    };

    const episode: Episode = {
      id: previousEpisode?.id ?? reasoning.goal.id,
      conversationId: opts.conversation.id,
      turns: [...(previousEpisode?.turns ?? []), episodeTurn].slice(-50),
    };

    return { operational, shadow, episode };
  }

  toAiStatePatch(brain: BrainV2State): Partial<AiConversationState> {
    return { brain_v2: brain } as Partial<AiConversationState>;
  }
}
