import type { ClinicConfig } from "../../clinic/clinic-config";
import type { PerceivedFacts } from "../perception/perception";
import type { OperationalMemory } from "../types/memory";
import type { Action } from "../reasoning/actions/action";
import type { DomainGraph } from "../graph/domain-graph";
import { recomputeSatisfiedNodes, type StateGraph } from "../graph/state-graph";

export interface DomainPolicy {
  readonly domain: string;
  contributeToGraph(graph: DomainGraph, config: ClinicConfig): DomainGraph;
  registerActions(): Action[];
  normalizeObservation?(
    entity: string,
    value: unknown,
    state: StateGraph
  ): { status: "known" | "suspected"; value: unknown };
}

export function buildStateGraph(
  perceived: PerceivedFacts,
  memory: OperationalMemory,
  domain: DomainGraph
): StateGraph {
  const entities: StateGraph["entities"] = { ...memory.stateEntities };

  if (perceived.procedureId) {
    entities.procedure = {
      status: "known",
      value: perceived.procedureName ?? perceived.procedureId,
      confidence: 1,
    };
  }
  if (perceived.date) {
    entities.date = { status: "known", value: perceived.date, confidence: 1 };
  }
  if (perceived.time) {
    entities.slot = { status: "suspected", value: perceived.time, confidence: 0.9 };
  }
  if (perceived.confirmation === true) {
    entities.confirmation = { status: "known", value: true, confidence: 1 };
  }
  if (perceived.greeting) {
    entities.chat = { status: "known", value: "greeting", confidence: 1 };
  }
  if (memory.selections.patientId) {
    entities.patient = { status: "known", value: memory.selections.patientId, confidence: 1 };
  }
  if (memory.selections.serviceId && !entities.procedure) {
    entities.procedure = {
      status: "known",
      value: memory.selections.serviceId,
      confidence: 1,
    };
  }
  if (memory.selections.slot) {
    entities.slot = { status: "known", value: memory.selections.slot, confidence: 1 };
  }

  let state: StateGraph = {
    entities,
    satisfiedNodes: new Set(),
    conflicts: [],
    context: {},
  };
  return recomputeSatisfiedNodes(state, domain);
}

export function applyObservationToState(
  state: StateGraph,
  domain: DomainGraph,
  observation: { entity: string; value: unknown; status?: "known" | "suspected" }
): StateGraph {
  const next: StateGraph = {
    ...state,
    entities: {
      ...state.entities,
      [observation.entity]: {
        status: observation.status ?? "known",
        value: observation.value,
        confidence: 1,
      },
    },
    satisfiedNodes: new Set(state.satisfiedNodes),
    conflicts: [...state.conflicts],
    context: { ...state.context },
  };
  return recomputeSatisfiedNodes(next, domain);
}
