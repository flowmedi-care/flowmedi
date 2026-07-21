/**
 * Commands — intenções recusáveis. Transition é o único executor sobre Case/Tasks.
 * Transition NÃO conhece Modules (Finance/Agenda/WhatsApp).
 */

import type { CasePhase, PendingDecision } from "./types";

export type CaseCommandType =
  | "SetPhase"
  | "AssignOwner"
  | "SetPendingDecision"
  | "ClearPendingDecision"
  | "OpenCase"
  | "CloseCase"
  | "ReopenCase"
  | "CreateTask"
  | "CompleteTask";

export type SetPhaseCommand = {
  type: "SetPhase";
  caseId: string;
  phase: CasePhase;
  reason?: string;
};

export type AssignOwnerCommand = {
  type: "AssignOwner";
  caseId: string;
  owner: string;
};

export type SetPendingDecisionCommand = {
  type: "SetPendingDecision";
  caseId: string;
  pending: PendingDecision;
};

export type ClearPendingDecisionCommand = {
  type: "ClearPendingDecision";
  caseId: string;
};

export type OpenCaseCommand = {
  type: "OpenCase";
  caseId: string;
};

export type CloseCaseCommand = {
  type: "CloseCase";
  caseId: string;
  reason?: string;
};

export type ReopenCaseCommand = {
  type: "ReopenCase";
  caseId: string;
};

export type CreateTaskCommand = {
  type: "CreateTask";
  caseId: string;
  title: string;
  assignee_role?: string | null;
  due_at?: string | null;
  source_event_id?: string | null;
};

export type CompleteTaskCommand = {
  type: "CompleteTask";
  caseId: string;
  taskId: string;
};

export type CaseCommand =
  | SetPhaseCommand
  | AssignOwnerCommand
  | SetPendingDecisionCommand
  | ClearPendingDecisionCommand
  | OpenCaseCommand
  | CloseCaseCommand
  | ReopenCaseCommand
  | CreateTaskCommand
  | CompleteTaskCommand;

/** Comandos permitidos no Transition — guardrail anti God-object. */
export const TRANSITION_ALLOWED_COMMANDS: ReadonlySet<CaseCommandType> = new Set([
  "SetPhase",
  "AssignOwner",
  "SetPendingDecision",
  "ClearPendingDecision",
  "OpenCase",
  "CloseCase",
  "ReopenCase",
  "CreateTask",
  "CompleteTask",
]);
