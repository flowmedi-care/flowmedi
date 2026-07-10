import type { PerceivedFacts } from "../../perception/perception";
import type { OperationalMemory } from "../../types/memory";
import type { Goal } from "../../types/goal";
import { newGoalId } from "../../types/goal";
import type { StateGraph } from "../../graph/state-graph";
import type { HistoryMessage } from "../../types/messages";

export interface GoalInferenceEngine {
  infer(
    state: StateGraph,
    perceived: PerceivedFacts,
    history: HistoryMessage[],
    activeGoal: Goal | null
  ): Goal;
}

export class RulesGoalInferenceEngine implements GoalInferenceEngine {
  infer(
    state: StateGraph,
    perceived: PerceivedFacts,
    _history: HistoryMessage[],
    activeGoal: Goal | null
  ): Goal {
    if (activeGoal && activeGoal.type !== "unknown" && activeGoal.type !== "chat") {
      return { ...activeGoal, id: activeGoal.id };
    }

    if (perceived.menuGoal === "book" || perceived.scheduleSignal) {
      return {
        id: newGoalId(),
        type: "booking",
        target: perceived.procedureName
          ? { kind: "procedure", id: perceived.procedureId, name: perceived.procedureName }
          : undefined,
        desiredNode: "appointment.created",
      };
    }

    if (perceived.menuGoal === "price" || perceived.priceSignal) {
      return {
        id: newGoalId(),
        type: "price",
        target: perceived.procedureName
          ? { kind: "procedure", id: perceived.procedureId, name: perceived.procedureName }
          : undefined,
        desiredNode: "price.known",
      };
    }

    if (perceived.menuGoal === "handoff" || perceived.handoffSignal) {
      return { id: newGoalId(), type: "handoff", desiredNode: "handoff.completed" };
    }

    if (perceived.faqSignal) {
      return { id: newGoalId(), type: "faq", desiredNode: "faq.answered" };
    }

    if (perceived.discoverySignal || perceived.menuGoal === "clarify") {
      return { id: newGoalId(), type: "inform", desiredNode: "faq.answered" };
    }

    if (perceived.greeting || perceived.thanks) {
      return { id: newGoalId(), type: "chat", desiredNode: "chat.acknowledged" };
    }

    if (state.entities.procedure?.status === "known" && !perceived.priceSignal) {
      return {
        id: newGoalId(),
        type: "booking",
        target: {
          kind: "procedure",
          id: String(state.entities.procedure.value ?? ""),
          name: String(state.entities.procedure.value ?? ""),
        },
        desiredNode: "appointment.created",
      };
    }

    return { id: newGoalId(), type: "unknown", desiredNode: "chat.acknowledged" };
  }
}

export function readActiveGoal(memory: OperationalMemory): Goal | null {
  return memory.activeGoalData ?? null;
}
