import type { CostHeuristic } from "../../planning/remaining-cost";
import { defaultHeuristic } from "../../planning/remaining-cost";
import { allActions } from "../../policies";
import type { ActionProvider } from "./ask-action-provider";
import { AskActionProvider, ToolActionProvider } from "./ask-action-provider";
import { FinishActionProvider } from "./finish-action-provider";

export function createActionProviders(
  actions = allActions(),
  heuristic: CostHeuristic = defaultHeuristic
): ActionProvider[] {
  return [
    new AskActionProvider(actions),
    new ToolActionProvider(actions),
    new FinishActionProvider(actions, heuristic),
  ];
}

export const defaultActionProviders = createActionProviders();
