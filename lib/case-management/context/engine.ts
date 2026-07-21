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
import { buildFinanceSummary, type FinanceSummary } from "../projections/finance";

export type WorkspaceHeader = {
  displayName: string;
  processTypeName: string;
  workflowName: string;
  phaseName: string;
  phaseCode: string;
  ownerLabel: string;
  pendingDecision: PendingDecision | null;
  executionContext: ExecutionContext;
  openTasksCount: number;
  nextAppointmentLabel: string | null;
  quoteBadge: string | null;
  finance: FinanceSummary;
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
    quoteBadge?: string | null;
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

  return {
    case: journeyCase,
    header: {
      displayName: enrichment?.displayName ?? journeyCase.contact_id,
      processTypeName,
      workflowName,
      phaseName: phase?.name ?? phaseCode,
      phaseCode,
      ownerLabel: ownerLabel(journeyCase),
      pendingDecision: journeyCase.pending_decision,
      executionContext: journeyCase.execution_context,
      openTasksCount,
      nextAppointmentLabel: enrichment?.nextAppointmentLabel ?? null,
      quoteBadge: enrichment?.quoteBadge ?? null,
      finance,
    },
    tasks,
    phases,
    primaryPanels: panelsForPhaseCode(phaseCode),
    priorityActions: journeyCase.pending_decision
      ? [journeyCase.pending_decision.label || journeyCase.pending_decision.type]
      : [],
  };
}

/** Pure — usado também em testes sem DB. */
export function panelsForPhaseCode(phaseCode: string): string[] {
  const panelsByPhase: Record<string, string[]> = {
    captacao: ["chat", "lead", "tasks", "timeline"],
    comercial: ["chat", "lead", "tasks", "timeline", "financeiro"],
    consulta: ["agenda", "anamnese", "tasks", "timeline"],
    financeiro: ["financeiro", "tasks", "timeline"],
    pos: ["chat", "tasks", "timeline", "financeiro"],
    retorno_marcado: ["agenda", "chat", "tasks"],
    tratamento: ["agenda", "tasks", "financeiro", "timeline"],
    sessoes: ["agenda", "tasks", "timeline"],
    alta: ["timeline", "tasks"],
    tentativas: ["chat", "tasks", "timeline"],
    contato: ["chat", "tasks"],
    retornou: ["agenda", "chat"],
    perdido: ["timeline", "lead"],
  };
  return panelsByPhase[phaseCode] ?? ["chat", "tasks", "timeline"];
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
