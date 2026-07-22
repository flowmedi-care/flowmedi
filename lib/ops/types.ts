/** Owner operacional do atendimento. Nunca ambíguo. */
export type OperationsOwner = "ai" | "human" | "system" | "patient_waiting";

export type PendingDecisionPriority = "low" | "normal" | "high" | "urgent";

export type PendingDecisionSource =
  | "conversation"
  | "journey"
  | "crm"
  | "appointment"
  | "system";

export type PendingDecisionStatus =
  | "pending"
  | "in_progress"
  | "snoozed"
  | "resolved"
  | "cancelled";

export type PendingDecisionAction = {
  id: string;
  label: string;
  kind: string;
};

export type PendingDecision = {
  type: string;
  label: string;
  owner: OperationsOwner;
  priority: PendingDecisionPriority;
  dueAt: string | null;
  source: PendingDecisionSource;
  status: PendingDecisionStatus;
  actions: PendingDecisionAction[];
};

export type OwnershipHistoryEntry = {
  at: string;
  owner: OperationsOwner;
  ownerUserId: string | null;
  ownerLabel: string;
  reason?: string;
};

export type OperationsSla = {
  dueAt: string | null;
  secondsRemaining: number | null;
  breached: boolean;
};

/**
 * Projeção operacional read-only.
 * Reconstruível integralmente a partir do banco — não é estado em memória.
 */
export type OperationsSnapshot = {
  conversationId: string;
  clinicId: string;
  phoneNumber: string;
  contactName: string | null;
  status: string;
  owner: OperationsOwner;
  ownerUserId: string | null;
  ownerLabel: string;
  pendingDecision: PendingDecision | null;
  stage: string | null;
  patient: { id: string; name: string } | null;
  appointment: { id: string; scheduledAt: string; status: string } | null;
  aiEnabled: boolean;
  aiHandoffAt: string | null;
  aiUserOptOut: boolean;
  operatorNotes: string | null;
  brief: string | null;
  pipelineId: string | null;
  sla: OperationsSla;
  ownershipHistory: OwnershipHistoryEntry[];
  /** Pode o usuário atual digitar no composer? */
  canCompose: boolean;
  /** Label do condutor atual para banner do composer */
  conductorLabel: string;
};

export type ConversationOpsRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  contact_name?: string | null;
  status?: string | null;
  patient_id?: string | null;
  assigned_secretary_id?: string | null;
  assigned_at?: string | null;
  ai_enabled?: boolean | null;
  ai_handoff_at?: string | null;
  ai_user_opt_out?: boolean | null;
  last_inbound_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  pipeline_id?: string | null;
  operator_notes?: string | null;
  ops_brief?: string | null;
  pending_decision?: PendingDecision | Record<string, unknown> | null;
  ops_owner_type?: OperationsOwner | null;
  ops_owner_user_id?: string | null;
  ownership_history?: OwnershipHistoryEntry[] | null;
  ai_state?: Record<string, unknown> | null;
  journey_case_id?: string | null;
};

export type MutatorResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; conflict?: boolean; currentOwnerUserId?: string | null; currentOwnerLabel?: string };
