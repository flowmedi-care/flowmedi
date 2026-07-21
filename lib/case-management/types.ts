/**
 * Ops de atendimento — tipos do núcleo congelado 10/10.
 * Case magro: ProcessType × WorkflowVersion × Phase (UUID).
 */

export type ProcessTypeCode =
  | "primeira_consulta"
  | "retorno"
  | "tratamento"
  | "reativacao"
  | "suporte"
  | "orcamento";

export type WorkflowVersionStatus = "draft" | "published" | "deprecated";

/** Ciclo operacional do Case — ≠ WorkflowVersion.status */
export type CaseStatus = "active" | "waiting" | "completed" | "cancelled";

/**
 * Código de fase (estável entre versions) — usado por policies/automation.
 * A identidade canônica no Case é `phase_id` (UUID na WorkflowVersion).
 */
export type CasePhase =
  | "captacao"
  | "comercial"
  | "consulta"
  | "financeiro"
  | "pos"
  | "reengajamento"
  | "retorno_marcado"
  | "tratamento"
  | "sessoes"
  | "alta"
  | "tentativas"
  | "contato"
  | "retornou"
  | "perdido"
  | "fechado";

export type OwnerType = "ai" | "human" | "system" | "patient";

export type TriggerType = "manual" | "event" | "automation";

export type EventCategory = "domain" | "integration" | "internal";

export type PendingDecision = {
  type: string;
  waiting_for: string;
  label?: string | null;
  due_at?: string | null;
};

/** Execução técnica em voo — não misturar com pending_decision */
export type ExecutionContext = {
  operation: string;
  tool?: string;
  started_at: string;
  correlation_id?: string;
  meta?: Record<string, unknown>;
} | null;

export type ProcessType = {
  id: string;
  code: ProcessTypeCode;
  name: string;
};

export type Workflow = {
  id: string;
  clinic_id: string | null;
  process_type_id: string;
  code: string;
  name: string;
};

export type WorkflowVersion = {
  id: string;
  workflow_id: string;
  version: number;
  status: WorkflowVersionStatus;
  automation_policy: AutomationPolicy;
};

export type AutomationPolicy = {
  on_enter_phase?: Record<string, string[]>;
};

export type WorkflowPhase = {
  id: string;
  workflow_version_id: string;
  code: string;
  name: string;
  sort_order: number;
  terminal: boolean;
};

export type WorkflowTransition = {
  id: string;
  workflow_version_id: string;
  from_phase_id: string;
  to_phase_id: string;
  trigger_type: TriggerType;
  trigger_ref: string | null;
  conditions: Record<string, unknown>;
  actions: unknown[];
};

export type JourneyCase = {
  id: string;
  clinic_id: string;
  contact_id: string;
  lead_id: string | null;
  patient_id: string | null;
  process_type_id: string | null;
  workflow_version_id: string | null;
  phase_id: string | null;
  owner_type: OwnerType;
  owner_id: string | null;
  /** @deprecated use owner_type — legado string */
  owner: string;
  pending_decision: PendingDecision | null;
  execution_context: ExecutionContext;
  status: CaseStatus;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  /** legado — preferir phase via workflow_phases */
  journey_type?: string | null;
  phase?: string | null;
};

export type CaseTask = {
  id: string;
  case_id: string;
  clinic_id: string;
  type: string;
  title: string;
  status: "open" | "completed" | "cancelled";
  assigned_to: string | null;
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

export function ownerLabel(c: Pick<JourneyCase, "owner_type" | "owner_id" | "owner">): string {
  if (c.owner_type === "ai") return "IA";
  if (c.owner_type === "human") return c.owner_id ? `Humano` : "Humano";
  if (c.owner_type === "patient") return "Paciente";
  return "Sistema";
}
