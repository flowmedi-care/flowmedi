import type { CasePhase, CaseTask, JourneyCase, JourneyEventRecord } from "../types";
import { BOARD_PHASES, CASE_PHASE_LABELS, PHASE_DEFAULT_OBJECTIVE } from "../types";

export type BoardView =
  | "pipeline"
  | "comparecimento"
  | "financeiro"
  | "ia"
  | "pendencias";

export type PipelineCard = {
  case: JourneyCase;
  displayName: string;
  objective: string;
  openTaskCount: number;
};

export type PipelineProjection = {
  view: "pipeline";
  columns: { phase: CasePhase; label: string; cards: PipelineCard[] }[];
};

export type AttendanceProjection = {
  view: "comparecimento";
  columns: { status: string; label: string; cards: PipelineCard[] }[];
};

export type FinanceProjection = {
  view: "financeiro";
  columns: { key: string; label: string; cards: PipelineCard[] }[];
};

export type QueueProjection = {
  view: "ia" | "pendencias";
  cards: PipelineCard[];
};

export type TimelineProjection = {
  events: JourneyEventRecord[];
};

export type CaseEnrichment = {
  displayName: string;
  appointmentStatus?: string | null;
  financeStatus?: "aberto" | "parcial" | "pago" | "nenhum" | null;
};

function toCard(
  c: JourneyCase,
  enrichment: CaseEnrichment,
  tasks: CaseTask[]
): PipelineCard {
  return {
    case: c,
    displayName: enrichment.displayName,
    objective: PHASE_DEFAULT_OBJECTIVE[c.phase],
    openTaskCount: tasks.filter((t) => t.status === "open" && t.case_id === c.id).length,
  };
}

export function buildPipelineProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  tasks: CaseTask[]
): PipelineProjection {
  const open = cases.filter((c) => c.status === "open" || c.status === "waiting");
  return {
    view: "pipeline",
    columns: BOARD_PHASES.map((phase) => ({
      phase,
      label: CASE_PHASE_LABELS[phase],
      cards: open
        .filter((c) => c.phase === phase)
        .map((c) =>
          toCard(
            c,
            enrichmentByCaseId[c.id] ?? { displayName: c.contact_id },
            tasks
          )
        ),
    })),
  };
}

const ATTENDANCE_STATUSES = [
  { status: "agendada", label: "Agendada" },
  { status: "confirmada", label: "Confirmada" },
  { status: "realizada", label: "Realizada" },
  { status: "falta", label: "Falta" },
  { status: "cancelada", label: "Cancelada" },
];

export function buildAttendanceProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  tasks: CaseTask[]
): AttendanceProjection {
  const relevant = cases.filter((c) => {
    const st = enrichmentByCaseId[c.id]?.appointmentStatus;
    return st && ATTENDANCE_STATUSES.some((a) => a.status === st);
  });
  return {
    view: "comparecimento",
    columns: ATTENDANCE_STATUSES.map(({ status, label }) => ({
      status,
      label,
      cards: relevant
        .filter((c) => enrichmentByCaseId[c.id]?.appointmentStatus === status)
        .map((c) =>
          toCard(c, enrichmentByCaseId[c.id] ?? { displayName: c.contact_id }, tasks)
        ),
    })),
  };
}

export function buildFinanceProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  tasks: CaseTask[]
): FinanceProjection {
  const keys = [
    { key: "aberto", label: "Aberto" },
    { key: "parcial", label: "Parcial" },
    { key: "pago", label: "Pago" },
  ] as const;
  const relevant = cases.filter((c) => {
    const f = enrichmentByCaseId[c.id]?.financeStatus;
    return f && f !== "nenhum";
  });
  return {
    view: "financeiro",
    columns: keys.map(({ key, label }) => ({
      key,
      label,
      cards: relevant
        .filter((c) => enrichmentByCaseId[c.id]?.financeStatus === key)
        .map((c) =>
          toCard(c, enrichmentByCaseId[c.id] ?? { displayName: c.contact_id }, tasks)
        ),
    })),
  };
}

export function buildAiQueueProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  tasks: CaseTask[]
): QueueProjection {
  return {
    view: "ia",
    cards: cases
      .filter((c) => c.status !== "closed" && (c.owner === "ai" || c.owner.startsWith("ai:")))
      .map((c) =>
        toCard(c, enrichmentByCaseId[c.id] ?? { displayName: c.contact_id }, tasks)
      ),
  };
}

export function buildPendingQueueProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  tasks: CaseTask[]
): QueueProjection {
  return {
    view: "pendencias",
    cards: cases
      .filter((c) => c.status !== "closed" && c.pending_decision != null)
      .map((c) =>
        toCard(c, enrichmentByCaseId[c.id] ?? { displayName: c.contact_id }, tasks)
      ),
  };
}

export function buildTimelineProjection(
  events: JourneyEventRecord[]
): TimelineProjection {
  return {
    events: [...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  };
}
