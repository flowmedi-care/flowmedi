import type { PrimaryGoal } from "./understanding";

export type AwaitingKind =
  | "menu_choice"
  | "question"
  | "patient_name"
  | "service"
  | "datetime"
  | "confirm"
  | null;

export type OperationalMemory = {
  activeGoal: string | null;
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
  lastPlanGoal: PrimaryGoal | null;
};

export const initialOperationalMemory = (): OperationalMemory => ({
  activeGoal: null,
  awaiting: null,
  selections: {},
  retrievalAttempts: 0,
  frustrationScore: 0,
});
