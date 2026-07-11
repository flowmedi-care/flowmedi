import type { AiState } from "../state/types";

export type MutationOutcome =
  | "success"
  | "recoverable"
  | "business"
  | "infrastructure"
  | "fatal";

export type MutationEntities = {
  patient?: string;
  appointment?: string;
  conversation?: string;
  payment?: string;
  examRequest?: string;
  invoice?: string;
  insuranceAuthorization?: string;
  [key: string]: string | undefined;
};

export type MutationResult = {
  outcome: MutationOutcome;
  mutation: string;
  statePatch?: Partial<AiState>;
  entities?: MutationEntities;
  userMessage?: string;
  errorMessage?: string;
};

export function isHandoffOutcome(outcome: MutationOutcome): boolean {
  return outcome === "fatal" || outcome === "infrastructure";
}

export function shouldIncrementToolFailures(outcome: MutationOutcome): boolean {
  return outcome === "infrastructure" || outcome === "fatal";
}
