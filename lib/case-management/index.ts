/**
 * Case Management núcleo (V5+)
 *
 * Invariantes:
 * - Case = Aggregate Root mínimo
 * - Modules não se chamam; só Domain Events
 * - Transition só Case/Tasks/Pending
 * - phase é materializado (verdade = events)
 * - IA só publishDomainEvent
 */

export * from "./types";
export * from "./events";
export * from "./commands";
export {
  publishDomainEvent,
  publishBusinessOutcome,
  rebuildCasePhase,
} from "./bus";
export type { PublishEventInput, PublishEventResult } from "./bus";
export { dispatchCommand, dispatchCommands } from "./transition/engine";
export {
  buildPolicyBundle,
  evaluatePolicies,
  resolveClinicPolicy,
  resolveAIPolicy,
  aiMayPublishEvent,
  DEFAULT_AI_POLICY,
  DEFAULT_CLINIC_POLICY,
} from "./policies";
export type { AIPolicyConfig, ClinicPolicyConfig } from "./policies";
export { buildWorkspaceContext } from "./context/engine";
export type { WorkspaceContext, WorkspacePanel } from "./context/engine";
export {
  buildPipelineProjection,
  buildAttendanceProjection,
  buildFinanceProjection,
  buildAiQueueProjection,
  buildPendingQueueProjection,
  buildTimelineProjection,
} from "./projections";
export type {
  BoardView,
  PipelineProjection,
  PipelineCard,
  CaseEnrichment,
} from "./projections";
export {
  getCaseById,
  getOpenCaseByContact,
  listCasesForClinic,
  listTasksForCase,
  listEventsForCase,
  insertCase,
  contactIdFromLead,
  contactIdFromPatient,
  parseContactId,
} from "./repository-exports";
