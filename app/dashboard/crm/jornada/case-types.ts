/**
 * Tipos compartilhados da Jornada — sem "use server".
 * Server actions ficam só em case-actions.ts (apenas funções async).
 */

import type {
  BoardView,
  CasePhase,
  CaseTask,
  JourneyCase,
  JourneyEventRecord,
  PipelineCard,
  WorkspaceContext,
} from "@/lib/case-management";
import type {
  AttendanceProjection,
  FinanceProjection,
  PipelineProjection,
  QueueProjection,
} from "@/lib/case-management/projections";
export type { BoardView, CasePhase, PipelineCard };

export type BoardPayload = {
  view: BoardView;
  pipeline: PipelineProjection;
  attendance: AttendanceProjection;
  finance: FinanceProjection;
  aiQueue: QueueProjection;
  pendingQueue: QueueProjection;
};

export type WorkspacePayload = {
  case: JourneyCase;
  tasks: CaseTask[];
  timeline: JourneyEventRecord[];
  context: WorkspaceContext;
  displayName: string;
  phaseLabel: string;
  journeyTypeLabel: string;
  objective: string;
  labels: { phases: Record<CasePhase, string> };
};
