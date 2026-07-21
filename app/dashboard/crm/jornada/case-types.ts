/**
 * Tipos da Jornada — sem "use server".
 */

import type {
  AttendanceCard,
  BoardView,
  CaseTask,
  JourneyCase,
  JourneyEventRecord,
  PipelineCard,
  WorkflowPhase,
} from "@/lib/case-management";
import type { WorkspaceHeader } from "@/lib/case-management";

export type { BoardView, PipelineCard, AttendanceCard };

export type BoardPayload = {
  view: BoardView;
  workflowVersionId: string | null;
  workflows: {
    workflow_id: string;
    version_id: string;
    name: string;
    process_type_name: string;
  }[];
  phases: WorkflowPhase[];
  fluxo: {
    columns: { phaseId: string; code: string; label: string; cards: PipelineCard[] }[];
  };
  comparecimento: {
    columns: { status: string; label: string; cards: AttendanceCard[] }[];
  };
  aiQueue: { cards: PipelineCard[] };
  pendingQueue: { cards: PipelineCard[] };
};

export type WorkspacePayload = {
  case: JourneyCase;
  header: WorkspaceHeader;
  tasks: CaseTask[];
  timeline: JourneyEventRecord[];
  primaryPanels: string[];
  priorityActions: string[];
};
