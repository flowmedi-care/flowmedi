import type { PerceivedFacts } from "../perception/perception";
import type { Goal } from "../types/goal";
import type { HistoryMessage } from "../types/messages";
import type { OperationalMemory } from "../types/memory";
import type { DomainGraph } from "../graph/domain-graph";
import type { StateGraph } from "../graph/state-graph";
import { applyObservationToState } from "../policies/domain-policy";
import { unsatisfiedNodes, reachableNodes } from "../graph/traversal";
import { defaultHeuristic } from "../planning/remaining-cost";
import { chooseBestAction, scoreAction, type ScoredAction } from "../planning/score-action";
import type { Action } from "./actions/action";
import { actionToDecision, type Decision } from "./actions/action";
import type { ActionProvider } from "./actions/ask-action-provider";
import { createActionProviders } from "./actions/provider-registry";
import {
  RulesGoalInferenceEngine,
  readActiveGoal,
} from "./goal-inference/rules-goal-inference";
import type { GoalInferenceEngine } from "./goal-inference/goal-inference-engine";
import { buildDomainGraph } from "../graph/graphs/booking.graph";
import { mergeMemory } from "./pipeline/merge-memory";
import { inferBeliefs } from "./pipeline/infer-beliefs";
import { explainReasoning } from "./pipeline/explain";

export type ReasoningState = {
  state: StateGraph;
  goal: Goal;
  domain: DomainGraph;
  unsatisfied: string[];
  reachable: string[];
  remainingCost: number;
  candidates: ScoredAction[];
  decision: Decision;
  chosenAction: Action;
  reasoning: string;
};

export type ThinkInput = {
  perceived: PerceivedFacts;
  memory: OperationalMemory;
  domain?: DomainGraph;
  goalEngine?: GoalInferenceEngine;
  actionProviders?: ActionProvider[];
  observation?: { entity: string; value: unknown; status?: "known" | "suspected" } | null;
  history?: HistoryMessage[];
};

export class Reasoner {
  private readonly goalEngine: GoalInferenceEngine;
  private readonly actionProviders: ActionProvider[];
  private readonly domain: DomainGraph;

  constructor(opts?: {
    goalEngine?: GoalInferenceEngine;
    actionProviders?: ActionProvider[];
    domain?: DomainGraph;
  }) {
    this.goalEngine = opts?.goalEngine ?? new RulesGoalInferenceEngine();
    this.domain = opts?.domain ?? buildDomainGraph();
    this.actionProviders =
      opts?.actionProviders ?? createActionProviders(undefined, defaultHeuristic);
  }

  think(input: ThinkInput): ReasoningState {
    const domain = input.domain ?? this.domain;
    const merged = mergeMemory(input.perceived, input.memory);
    let state = inferBeliefs(merged, domain);

    if (input.observation) {
      state = applyObservationToState(state, domain, input.observation);
    }

    const activeGoal = readActiveGoal(input.memory);
    const goal = this.goalEngine.infer(
      state,
      input.perceived,
      input.history ?? [],
      activeGoal
    );

    const unsatisfied = unsatisfiedNodes(domain, goal.desiredNode, state);
    const reachable = reachableNodes(domain, state);
    const remainingCost = defaultHeuristic.remainingCost(goal, domain, state);

    const actions = this.actionProviders.flatMap((p) =>
      p.enumerate(state, goal, domain)
    );

    const candidates = actions
      .map((action) => scoreAction(action, goal, domain, state, defaultHeuristic))
      .filter((c): c is ScoredAction => c !== null);

    let chosenAction =
      chooseBestAction(candidates) ??
      actions.find((a) => a.id === "ask.greet") ??
      actions[0];

    if (goal.type === "chat") {
      chosenAction = actions.find((a) => a.id === "ask.greet") ?? chosenAction;
    }

    const decision = actionToDecision(chosenAction);

    const result: ReasoningState = {
      state,
      goal,
      domain,
      unsatisfied,
      reachable,
      remainingCost,
      candidates,
      decision,
      chosenAction,
      reasoning: "",
    };
    result.reasoning = explainReasoning({
      goal: result.goal,
      remainingCost: result.remainingCost,
      unsatisfied: result.unsatisfied,
      chosenAction: result.chosenAction,
      candidates: result.candidates,
    });
    return result;
  }
}
