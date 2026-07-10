import type { PerceivedFacts } from "../perception/perception";
import type { Goal } from "../types/goal";
import type { HistoryMessage } from "../types/messages";
import type { OperationalMemory } from "../types/memory";
import type { DomainGraph } from "../graph/domain-graph";
import type { StateGraph } from "../graph/state-graph";
import { applyObservationToState, buildStateGraph } from "../policies/domain-policy";
import { buildDomainGraph } from "../graph/graphs/booking.graph";
import { unsatisfiedNodes, reachableNodes } from "../graph/traversal";
import { defaultHeuristic } from "../planning/remaining-cost";
import { chooseBestAction, scoreAction, type ScoredAction } from "../planning/score-action";
import type { Action } from "./actions/action";
import { actionToDecision, type Decision } from "./actions/action";
import type { ActionProvider } from "./actions/action-provider";
import { defaultActionProvider } from "./actions/action-provider";
import {
  GoalInferenceEngine,
  RulesGoalInferenceEngine,
  readActiveGoal,
} from "./goal-inference/rules-goal-inference";

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
};

function explain(state: ReasoningState): string {
  const parts = [
    `goal=${state.goal.type}:${state.goal.desiredNode}`,
    `remainingCost=${state.remainingCost}`,
    `unsatisfied=[${state.unsatisfied.join(",")}]`,
    `chosen=${state.chosenAction.id}`,
  ];
  return parts.join("; ");
}

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
    this.actionProviders = opts?.actionProviders ?? [defaultActionProvider];
    this.domain = opts?.domain ?? buildDomainGraph();
  }

  think(input: ThinkInput): ReasoningState {
    const domain = input.domain ?? this.domain;
    let state = buildStateGraph(input.perceived, input.memory, domain);

    if (input.observation) {
      state = applyObservationToState(state, domain, input.observation);
    }

    const activeGoal = readActiveGoal(input.memory);
    const goal = this.goalEngine.infer(state, input.perceived, [], activeGoal);

    const unsatisfied = unsatisfiedNodes(domain, goal.desiredNode, state);
    const reachable = reachableNodes(domain, state);
    const remainingCost = defaultHeuristic.remainingCost(goal, domain, state);

    const actions = this.actionProviders.flatMap((p) =>
      p.enumerate(state, goal, domain)
    );

    const candidates = actions
      .filter((action) => {
        if (remainingCost > 0 && action.kind === "finish") return false;
        if (goal.type !== "chat" && action.id === "finish.chat") return false;
        if (goal.type !== "price" && action.id === "finish.price") return false;
        if (goal.type !== "booking" && action.id === "finish.booking") return false;
        return true;
      })
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
    result.reasoning = explain(result);
    return result;
  }
}
