import type { ScoredAction } from "../planning/score-action";
import type { Decision } from "../reasoning/actions/action";
import type { Goal } from "./goal";
import type { PerceivedFacts } from "../perception/perception";
import type { StateGraph } from "../graph/state-graph";
import type { StateTransition } from "./transition";

export type EpisodeTurn = {
  turnId: string;
  timestamp: string;
  perceived: PerceivedFacts;
  state: StateGraph;
  goal: Goal;
  domain: { satisfied: string[]; unsatisfied: string[]; reachable: string[] };
  remainingCost: number;
  candidates: ScoredAction[];
  decision: Decision;
  chosenTransitions: StateTransition[];
  reasoning: string;
  toolResults?: Record<string, unknown>;
};

export type Episode = {
  id: string;
  conversationId: string;
  turns: EpisodeTurn[];
};
