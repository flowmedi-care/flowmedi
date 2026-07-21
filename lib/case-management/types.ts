/**
 * Case Management — tipos do núcleo (V5+).
 * Case = Aggregate Root mínimo. phase é materializado (verdade = events).
 */

export type JourneyType =
  | "primeira_consulta"
  | "retorno"
  | "tratamento"
  | "reativacao"
  | "suporte"
  | "orcamento";

/** Fase materializada — read model no Case, não verdade do domínio. */
export type CasePhase =
  | "captacao"
  | "comercial"
  | "consulta"
  | "financeiro"
  | "pos"
  | "reengajamento"
  | "perdido"
  | "fechado";

export type CaseStatus = "open" | "waiting" | "closed";

export type EventCategory = "domain" | "integration" | "internal";

export type ActorKind = "ai" | "human" | "system" | "patient";

export type PendingDecision = {
  actor_role: string;
  label?: string | null;
  due_at?: string | null;
};

export type JourneyCase = {
  id: string;
  clinic_id: string;
  contact_id: string;
  lead_id: string | null;
  patient_id: string | null;
  journey_type: JourneyType;
  phase: CasePhase;
  owner: string;
  pending_decision: PendingDecision | null;
  status: CaseStatus;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseTaskStatus = "open" | "completed" | "cancelled";

export type CaseTask = {
  id: string;
  case_id: string;
  clinic_id: string;
  title: string;
  status: CaseTaskStatus;
  assignee_role: string | null;
  due_at: string | null;
  source_event_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JourneyEventRecord = {
  id: string;
  clinic_id: string;
  case_id: string | null;
  category: EventCategory;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  evidence: string | null;
  created_at: string;
};

export const CASE_PHASE_LABELS: Record<CasePhase, string> = {
  captacao: "Captação",
  comercial: "Comercial",
  consulta: "Consulta",
  financeiro: "Financeiro",
  pos: "Pós-consulta",
  reengajamento: "Reengajamento",
  perdido: "Perdido",
  fechado: "Fechado",
};

export const JOURNEY_TYPE_LABELS: Record<JourneyType, string> = {
  primeira_consulta: "Primeira consulta",
  retorno: "Retorno",
  tratamento: "Tratamento",
  reativacao: "Reativação",
  suporte: "Suporte",
  orcamento: "Orçamento",
};

/** Objective derivado de phase (config default — não persistido). */
export const PHASE_DEFAULT_OBJECTIVE: Record<CasePhase, string> = {
  captacao: "Qualificar",
  comercial: "Fechar / agendar",
  consulta: "Realizar atendimento",
  financeiro: "Receber pagamento",
  pos: "Encerrar ciclo / marcar retorno",
  reengajamento: "Reativar",
  perdido: "—",
  fechado: "—",
};

export const BOARD_PHASES: CasePhase[] = [
  "captacao",
  "comercial",
  "consulta",
  "financeiro",
  "pos",
  "reengajamento",
];

export function contactIdFromLead(leadId: string): string {
  return `lead:${leadId}`;
}

export function contactIdFromPatient(patientId: string): string {
  return `patient:${patientId}`;
}

export function parseContactId(
  contactId: string
): { kind: "lead" | "patient"; id: string } | null {
  const m = contactId.match(/^(lead|patient):(.+)$/);
  if (!m) return null;
  return { kind: m[1] as "lead" | "patient", id: m[2] };
}
