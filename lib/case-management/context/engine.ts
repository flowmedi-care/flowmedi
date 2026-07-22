/**
 * Context Adapter — monta o contexto do Workspace a partir do Case magro + projections.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countOpenTasks,
  getCaseById,
  getPhasesForVersion,
  listTasksForCase,
} from "../repository";
import type {
  CaseTask,
  ExecutionContext,
  JourneyCase,
  PendingDecision,
  WorkflowPhase,
} from "../types";
import { ownerLabel } from "../types";
import { resolveNextAction, type ResolvedNextAction } from "../next-action";
import { buildFinanceSummary, type FinanceSummary } from "../projections/finance";

export type NextAction = ResolvedNextAction;

export type WorkspaceHeader = {
  displayName: string;
  processTypeName: string;
  workflowName: string;
  phaseName: string;
  phaseCode: string;
  ownerLabel: string;
  pendingDecision: PendingDecision | null;
  nextAction: NextAction | null;
  executionContext: ExecutionContext;
  openTasksCount: number;
  nextAppointmentLabel: string | null;
  nextAppointmentId: string | null;
  quoteBadge: string | null;
  finance: FinanceSummary;
  conversationId: string | null;
  conversationHref: string | null;
};

export type WorkspaceContextPayload = {
  case: JourneyCase;
  header: WorkspaceHeader;
  tasks: CaseTask[];
  phases: WorkflowPhase[];
  primaryPanels: string[];
  priorityActions: string[];
};

export async function buildWorkspaceContext(
  db: SupabaseClient,
  caseId: string,
  enrichment?: {
    displayName?: string;
    nextAppointmentLabel?: string | null;
    nextAppointmentId?: string | null;
    nextAppointmentStatus?: string | null;
    nextAppointmentAt?: string | null;
    quoteBadge?: string | null;
    ownerHumanName?: string | null;
    conversationId?: string | null;
  }
): Promise<WorkspaceContextPayload | null> {
  const journeyCase = await getCaseById(db, caseId);
  if (!journeyCase) return null;

  const [tasks, openTasksCount, phases, finance] = await Promise.all([
    listTasksForCase(db, caseId),
    countOpenTasks(db, caseId),
    journeyCase.workflow_version_id
      ? getPhasesForVersion(db, journeyCase.workflow_version_id)
      : Promise.resolve([] as WorkflowPhase[]),
    buildFinanceSummary(db, journeyCase),
  ]);

  const phase = phases.find((p) => p.id === journeyCase.phase_id);

  let processTypeName = journeyCase.journey_type ?? "Processo";
  let workflowName = "Fluxo";
  if (journeyCase.process_type_id) {
    const { data: pt } = await db
      .from("process_types")
      .select("name")
      .eq("id", journeyCase.process_type_id)
      .maybeSingle();
    if (pt?.name) processTypeName = String(pt.name);
  }
  if (journeyCase.workflow_version_id) {
    const { data: wv } = await db
      .from("workflow_versions")
      .select("workflow_id, workflows(name)")
      .eq("id", journeyCase.workflow_version_id)
      .maybeSingle();
    const wf = Array.isArray(wv?.workflows) ? wv?.workflows[0] : wv?.workflows;
    if (wf && typeof wf === "object" && "name" in wf) {
      workflowName = String((wf as { name: string }).name);
    }
  }

  const phaseCode = phase?.code ?? journeyCase.phase ?? "captacao";
  const appointmentInput =
    enrichment?.nextAppointmentId && enrichment.nextAppointmentAt
      ? {
          id: enrichment.nextAppointmentId,
          scheduledAt: enrichment.nextAppointmentAt,
          status: enrichment.nextAppointmentStatus ?? "agendada",
        }
      : null;
  const nextAction = resolveNextAction(journeyCase, tasks, appointmentInput);
  const conversationId = enrichment?.conversationId ?? null;

  return {
    case: journeyCase,
    header: {
      displayName: enrichment?.displayName ?? journeyCase.contact_id,
      processTypeName,
      workflowName,
      phaseName: phase?.name ?? phaseCode,
      phaseCode,
      ownerLabel: ownerLabel(journeyCase, enrichment?.ownerHumanName),
      pendingDecision: journeyCase.pending_decision,
      nextAction,
      executionContext: journeyCase.execution_context,
      openTasksCount,
      nextAppointmentLabel: enrichment?.nextAppointmentLabel ?? null,
      nextAppointmentId: enrichment?.nextAppointmentId ?? null,
      quoteBadge: enrichment?.quoteBadge ?? null,
      finance,
      conversationId,
      conversationHref: conversationId
        ? `/dashboard/whatsapp?c=${encodeURIComponent(conversationId)}`
        : "/dashboard/whatsapp",
    },
    tasks,
    phases,
    primaryPanels: panelsForPhaseCode(phaseCode),
    priorityActions: nextAction ? [nextAction.label] : [],
  };
}

/**
 * Painéis renderizados no Workspace.
 * Só declara o que a UI implementa (Lei 6 / anti-pattern — não prometer fantasma).
 */
export function panelsForPhaseCode(phaseCode: string): string[] {
  const panelsByPhase: Record<string, string[]> = {
    captacao: ["next_action", "chat", "lead", "tasks", "timeline"],
    comercial: ["next_action", "chat", "lead", "tasks", "timeline", "financeiro"],
    consulta: ["next_action", "agenda", "chat", "tasks", "timeline"],
    financeiro: ["next_action", "financeiro", "tasks", "timeline"],
    pos: ["next_action", "chat", "tasks", "timeline", "financeiro"],
    retorno_marcado: ["next_action", "agenda", "chat", "tasks"],
    tratamento: ["next_action", "agenda", "tasks", "financeiro", "timeline"],
    sessoes: ["next_action", "agenda", "tasks", "timeline"],
    alta: ["next_action", "timeline", "tasks"],
    tentativas: ["next_action", "chat", "tasks", "timeline"],
    contato: ["next_action", "chat", "tasks"],
    retornou: ["next_action", "agenda", "chat"],
    perdido: ["timeline", "lead"],
  };
  return panelsByPhase[phaseCode] ?? ["next_action", "chat", "tasks", "timeline"];
}

export function derivedObjectiveForPhase(phaseCode: string): string {
  const map: Record<string, string> = {
    captacao: "Qualificar lead",
    comercial: "Converter / orçar",
    consulta: "Garantir comparecimento",
    financeiro: "Receber pagamento",
    pos: "Acompanhar pós-consulta",
    perdido: "Encerrado",
  };
  return map[phaseCode] ?? "Operar o caso";
}
