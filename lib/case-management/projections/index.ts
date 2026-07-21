import type { CaseTask, JourneyCase, WorkflowPhase } from "../types";

export type BoardView = "pendencias" | "fluxo" | "comparecimento" | "ia";

export type PipelineCard = {
  case: JourneyCase;
  displayName: string;
  phaseName: string;
  phaseCode: string;
  openTaskCount: number;
  quoteBadge?: string | null;
};

export type CaseEnrichment = {
  displayName: string;
  appointmentStatus?: string | null;
  appointmentId?: string | null;
  quoteBadge?: string | null;
  openTaskCount?: number;
};

export type AttendanceCard = {
  appointmentId: string;
  caseId: string | null;
  displayName: string;
  status: string;
  scheduledAt: string;
  doctorName?: string | null;
};

export function buildFluxoProjection(
  cases: JourneyCase[],
  phases: WorkflowPhase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>
): { columns: { phaseId: string; code: string; label: string; cards: PipelineCard[] }[] } {
  const active = cases.filter(
    (c) => c.status === "active" || c.status === "waiting"
  );
  return {
    columns: phases
      .filter((p) => !p.terminal || p.code === "perdido")
      .map((phase) => ({
        phaseId: phase.id,
        code: phase.code,
        label: phase.name,
        cards: active
          .filter((c) => c.phase_id === phase.id || (!c.phase_id && c.phase === phase.code))
          .map((c) => toCard(c, enrichmentByCaseId[c.id], phase)),
      })),
  };
}

function toCard(
  c: JourneyCase,
  enrichment: CaseEnrichment | undefined,
  phase?: WorkflowPhase
): PipelineCard {
  return {
    case: c,
    displayName: enrichment?.displayName ?? c.contact_id,
    phaseName: phase?.name ?? c.phase ?? "—",
    phaseCode: phase?.code ?? c.phase ?? "",
    openTaskCount: enrichment?.openTaskCount ?? 0,
    quoteBadge: enrichment?.quoteBadge ?? null,
  };
}

export function buildPendingQueueProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>
): { cards: PipelineCard[] } {
  return {
    cards: cases
      .filter(
        (c) =>
          (c.status === "active" || c.status === "waiting") &&
          c.pending_decision != null
      )
      .map((c) => toCard(c, enrichmentByCaseId[c.id])),
  };
}

export function buildAiQueueProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>
): { cards: PipelineCard[] } {
  return {
    cards: cases
      .filter(
        (c) =>
          (c.status === "active" || c.status === "waiting") &&
          (c.owner_type === "ai" || c.owner === "ai" || c.owner?.startsWith("ai:"))
      )
      .map((c) => toCard(c, enrichmentByCaseId[c.id])),
  };
}

export function buildAttendanceProjectionFromAppointments(
  items: AttendanceCard[]
): {
  columns: { status: string; label: string; cards: AttendanceCard[] }[];
} {
  const statuses = [
    { status: "agendada", label: "Agendada" },
    { status: "confirmada", label: "Confirmada" },
    { status: "realizada", label: "Realizada" },
    { status: "falta", label: "Falta" },
    { status: "cancelada", label: "Cancelada" },
  ];
  return {
    columns: statuses.map(({ status, label }) => ({
      status,
      label,
      cards: items.filter((i) => i.status === status),
    })),
  };
}

/** @deprecated */
export function buildPipelineProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  _tasks: CaseTask[],
  phases: WorkflowPhase[] = []
) {
  return buildFluxoProjection(cases, phases, enrichmentByCaseId);
}

/** @deprecated — finance is module + workspace, not board view */
export function buildFinanceProjection() {
  return { view: "financeiro" as const, columns: [] };
}

export function buildAttendanceProjection(
  cases: JourneyCase[],
  enrichmentByCaseId: Record<string, CaseEnrichment>,
  _tasks?: CaseTask[]
) {
  const items: AttendanceCard[] = cases
    .filter((c) => enrichmentByCaseId[c.id]?.appointmentStatus)
    .map((c) => ({
      appointmentId: enrichmentByCaseId[c.id]?.appointmentId ?? c.id,
      caseId: c.id,
      displayName: enrichmentByCaseId[c.id]?.displayName ?? c.contact_id,
      status: enrichmentByCaseId[c.id]!.appointmentStatus!,
      scheduledAt: "",
    }));
  return buildAttendanceProjectionFromAppointments(items);
}

export function buildTimelineProjection(
  events: { id: string; event_type: string; actor: string; evidence: string | null; created_at: string; payload: Record<string, unknown>; clinic_id: string; case_id: string | null; category: string }[]
) {
  return {
    events: [...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  };
}
