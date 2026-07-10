import type { PerceivedFacts } from "../../perception/perception";
import type { Goal } from "../../types/goal";
import type { HistoryMessage } from "../../types/messages";
import type { StateGraph } from "../../graph/state-graph";

export interface GoalInferenceEngine {
  infer(
    state: StateGraph,
    perceived: PerceivedFacts,
    history: HistoryMessage[],
    activeGoal: Goal | null
  ): Goal;
}
