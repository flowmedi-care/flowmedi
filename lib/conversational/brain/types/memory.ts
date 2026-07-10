import type { EntityStatus } from "./transition";
import type { Goal } from "./goal";

export type AwaitingKind =
  | "menu_choice"
  | "question"
  | "patient_name"
  | "service"
  | "datetime"
  | "confirm"
  | null;

export type StateEntity = {
  status: EntityStatus;
  value?: unknown;
  confidence?: number;
};

export type OperationalMemory = {
  activeGoal: string | null;
  activeGoalData?: Goal | null;
  stateEntities: Record<string, StateEntity>;
  awaiting: AwaitingKind;
  selections: {
    patientId?: string;
    serviceId?: string;
    procedureId?: string;
    slot?: string;
    price?: number;
  };
  retrievalAttempts: number;
  frustrationScore: number;
  lastMenuShown?: { options: string[]; at: string };
};

export type ConversationShadow = {
  inferredPhase: "idle" | "gathering" | "confirming" | "handoff";
  inferredDomain: string | null;
  lastPlanGoal: string | null;
};

export const initialOperationalMemory = (): OperationalMemory => ({
  activeGoal: null,
  activeGoalData: null,
  stateEntities: {},
  awaiting: null,
  selections: {},
  retrievalAttempts: 0,
  frustrationScore: 0,
});
