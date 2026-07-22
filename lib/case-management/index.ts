/**
 * Case Management / Ops de atendimento (arquitetura 10/10)
 * Física: Event → (Transition ∥ Policy→Decision) → applyCaseCommands → Case
 */

export * from "./types";
export * from "./events";
export {
  publishDomainEvent,
  publishBusinessOutcome,
} from "./bus";
export type { PublishEventInput, PublishEventResult } from "./bus";
export { applyTransition, applyEventTrigger } from "./transition/engine";
export { applyCaseCommands, commandKey } from "./apply-commands";
export type { ApplyCommandsContext, ApplyCommandsResult } from "./apply-commands";
export {
  resolveActiveCaseForConversation,
  linkConversationToCase,
} from "./resolve-case";
export type {
  ResolveConversationCaseInput,
  ResolveConversationCaseResult,
} from "./resolve-case";
export { logPipelineStep } from "./observability";
export type { PipelineStep } from "./observability";
export { buildWorkspaceContext } from "./context/engine";
export type { WorkspaceHeader, WorkspaceContextPayload } from "./context/engine";
export { buildFinanceSummary } from "./projections/finance";
export type { FinanceSummary } from "./projections/finance";
export {
  buildFluxoProjection,
  buildPendingQueueProjection,
  buildAiQueueProjection,
  buildAttendanceProjectionFromAppointments,
  buildPipelineProjection,
  buildAttendanceProjection,
  buildTimelineProjection,
} from "./projections";
export type {
  BoardView,
  PipelineCard,
  CaseEnrichment,
  AttendanceCard,
} from "./projections";
export {
  getCaseById,
  getOpenCaseByContact,
  listCasesForClinic,
  listTasksForCase,
  listEventsForCase,
  insertCase,
  countOpenTasks,
  getPublishedWorkflowVersion,
  listPublishedWorkflows,
  getPhasesForVersion,
  contactIdFromLead,
  contactIdFromPatient,
  parseContactId,
} from "./repository-exports";
export { runAutomation, DEFAULT_RULES } from "./automation/engine";
export {
  buildPolicyBundle,
  evaluatePolicies,
  aiMayPublishEvent,
  resolveAIPolicy,
  resolveClinicPolicy,
} from "./policies";
