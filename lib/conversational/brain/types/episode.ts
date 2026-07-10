import type { ScoredAction } from "../planning/score-action";
import type { Decision } from "../reasoning/actions/action";
import type { Goal } from "./goal";
import type { PerceivedFacts } from "../perception/perception";

export type EpisodeTurn = {
  turnId: string;
  timestamp: string;
  perceived: PerceivedFacts;
  goal: Goal;
  unsatisfied: string[];
  reachable: string[];
  remainingCost: number;
  candidates: ScoredAction[];
  decision: Decision;
  reasoning: string;
  toolResults?: Record<string, unknown>;
};

export type Episode = {
  id: string;
  conversationId: string;
  turns: EpisodeTurn[];
};
