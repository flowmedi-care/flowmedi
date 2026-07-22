import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationOpsRow,
  OperationsSnapshot,
  OwnershipHistoryEntry,
  PendingDecision,
} from "./types";
import { computeSla, ownerLabel, resolveOperationsOwner } from "./resolve-owner";

function parsePendingDecision(raw: unknown): PendingDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!d.type || !d.label) return null;
  return {
    type: String(d.type),
    label: String(d.label),
    owner: (d.owner as PendingDecision["owner"]) || "human",
    priority: (d.priority as PendingDecision["priority"]) || "normal",
    dueAt: d.dueAt ? String(d.dueAt) : null,
    source: (d.source as PendingDecision["source"]) || "conversation",
    status: (d.status as PendingDecision["status"]) || "pending",
    actions: Array.isArray(d.actions)
      ? (d.actions as PendingDecision["actions"])
      : [],
  };
}

function parseOwnershipHistory(raw: unknown): OwnershipHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === "object" && (e as OwnershipHistoryEntry).at)
    .map((e) => {
      const entry = e as OwnershipHistoryEntry;
      return {
        at: String(entry.at),
        owner: entry.owner,
        ownerUserId: entry.ownerUserId ?? null,
        ownerLabel: String(entry.ownerLabel ?? entry.owner),
        reason: entry.reason,
      };
    });
}

export type SnapshotDeps = {
  assistantName?: string | null;
  assignedSecretaryName?: string | null;
  patientName?: string | null;
  appointment?: { id: string; scheduledAt: string; status: string } | null;
  stage?: string | null;
  /** Journey-derived pending decision when DB field empty */
  journeyPendingDecision?: PendingDecision | null;
  /** Current viewer (for canCompose) */
  viewerUserId?: string | null;
  viewerIsAdmin?: boolean;
  now?: Date;
};

/**
 * Constrói a projeção operacional read-only a partir da row + deps.
 * Única função que calcula owner/pendingDecision/SLA para UI, API e prompt.
 */
export function buildOperationsSnapshot(
  row: ConversationOpsRow,
  deps: SnapshotDeps = {}
): OperationsSnapshot {
  const { owner, ownerUserId } = resolveOperationsOwner(row);
  const humanName =
    owner === "human"
      ? deps.assignedSecretaryName
      : null;
  const label =
    owner === "ai"
      ? deps.assistantName?.trim() || "IA"
      : ownerLabel(owner, humanName);

  const pendingDecision =
    parsePendingDecision(row.pending_decision) ?? deps.journeyPendingDecision ?? null;

  const history = parseOwnershipHistory(row.ownership_history);
  if (history.length === 0) {
    history.push({
      at: row.ai_handoff_at || row.assigned_at || row.updated_at || row.created_at || new Date().toISOString(),
      owner,
      ownerUserId,
      ownerLabel: label,
      reason: "current",
    });
  }

  const sla = computeSla({
    owner,
    aiHandoffAt: row.ai_handoff_at ?? null,
    assignedAt: row.assigned_at ?? null,
    now: deps.now,
  });

  const viewerId = deps.viewerUserId ?? null;
  const isAdmin = Boolean(deps.viewerIsAdmin);
  let canCompose = false;
  if (owner === "human") {
    // Pool (sem assignee): precisa Assumir (claim) antes de digitar
    canCompose =
      Boolean(viewerId) &&
      Boolean(ownerUserId) &&
      (viewerId === ownerUserId || isAdmin);
  }

  const patient =
    row.patient_id
      ? { id: row.patient_id, name: deps.patientName?.trim() || "Paciente" }
      : null;

  return {
    conversationId: row.id,
    clinicId: row.clinic_id,
    phoneNumber: row.phone_number,
    contactName: row.contact_name ?? null,
    status: row.status ?? "open",
    owner,
    ownerUserId,
    ownerLabel: label,
    pendingDecision,
    stage: deps.stage ?? null,
    patient,
    appointment: deps.appointment ?? null,
    aiEnabled: row.ai_enabled !== false && !row.ai_handoff_at && !row.ai_user_opt_out,
    aiHandoffAt: row.ai_handoff_at ?? null,
    aiUserOptOut: Boolean(row.ai_user_opt_out),
    operatorNotes: row.operator_notes ?? null,
    brief: row.ops_brief ?? null,
    pipelineId: row.pipeline_id ?? null,
    journeyCaseId: row.journey_case_id ? String(row.journey_case_id) : null,
    sla,
    ownershipHistory: history,
    canCompose,
    conductorLabel: label,
  };
}

/**
 * Carrega row + deps e monta snapshot. Usado por API e prompt.
 */
export async function loadOperationsSnapshot(
  supabase: SupabaseClient,
  conversationId: string,
  opts: {
    viewerUserId?: string | null;
    viewerIsAdmin?: boolean;
  } = {}
): Promise<OperationsSnapshot | null> {
  const { data: row } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, clinic_id, phone_number, contact_name, status, patient_id, assigned_secretary_id, assigned_at, ai_enabled, ai_handoff_at, ai_user_opt_out, last_inbound_message_at, created_at, updated_at, pipeline_id, operator_notes, ops_brief, pending_decision, ops_owner_type, ops_owner_user_id, ownership_history, ai_state, journey_case_id"
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (!row) return null;

  const conv = row as ConversationOpsRow;

  let assignedSecretaryName: string | null = null;
  if (conv.assigned_secretary_id || conv.ops_owner_user_id) {
    const uid = conv.ops_owner_user_id || conv.assigned_secretary_id;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", uid!)
      .maybeSingle();
    assignedSecretaryName = prof?.full_name ?? null;
  }

  let patientName: string | null = null;
  let appointment: OperationsSnapshot["appointment"] = null;
  let stage: string | null = null;

  if (conv.patient_id) {
    const { data: patient } = await supabase
      .from("patients")
      .select("full_name")
      .eq("id", conv.patient_id)
      .maybeSingle();
    patientName = patient?.full_name ?? null;

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status")
      .eq("patient_id", conv.patient_id)
      .eq("clinic_id", conv.clinic_id)
      .in("status", ["agendada", "confirmada"])
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (appt) {
      appointment = {
        id: appt.id,
        scheduledAt: appt.scheduled_at,
        status: appt.status,
      };
    }
  }

  let leadNextAction: string | null = null;

  if (conv.pipeline_id) {
    const { data: lead } = await supabase
      .from("non_registered_pipeline")
      .select("lifecycle_stage, stage, next_action")
      .eq("id", conv.pipeline_id)
      .maybeSingle();
    stage = (lead?.lifecycle_stage as string) || (lead?.stage as string) || null;
    leadNextAction = (lead?.next_action as string | null) ?? null;
  } else if (conv.phone_number) {
    const digits = conv.phone_number.replace(/\D/g, "");
    const { data: lead } = await supabase
      .from("non_registered_pipeline")
      .select("id, lifecycle_stage, stage, next_action")
      .eq("clinic_id", conv.clinic_id)
      .or(`phone.eq.${digits},phone.eq.+${digits}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lead) {
      stage = (lead.lifecycle_stage as string) || (lead.stage as string) || null;
      leadNextAction = (lead.next_action as string | null) ?? null;
      if (!conv.pipeline_id && lead.id) {
        // expose via snapshot only; persist happens in event bridge
        conv.pipeline_id = lead.id;
      }
    }
  }

  const journeyStep = (conv.ai_state as { journey_step_code?: string } | null)?.journey_step_code;
  if (!stage && journeyStep) stage = journeyStep;

  const journeyPendingDecision: PendingDecision | null =
    !conv.pending_decision && leadNextAction
      ? {
          type: "crm_next_action",
          label: leadNextAction,
          owner: resolveOperationsOwner(conv).owner,
          priority: "normal",
          dueAt: null,
          source: "crm",
          status: "pending",
          actions: [{ id: "open_crm", label: "Abrir CRM", kind: "navigate_crm" }],
        }
      : null;

  const { data: va } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("assistant_name")
    .eq("clinic_id", conv.clinic_id)
    .maybeSingle();

  return buildOperationsSnapshot(conv, {
    assistantName: va?.assistant_name,
    assignedSecretaryName,
    patientName,
    appointment,
    stage,
    journeyPendingDecision,
    viewerUserId: opts.viewerUserId,
    viewerIsAdmin: opts.viewerIsAdmin,
  });
}

/** Formata bloco para o prompt da IA — único caminho. */
export function formatOperationsSnapshotForPrompt(snapshot: OperationsSnapshot): string {
  const lines = [
    "Contexto operacional (fonte da verdade — respeite o responsável):",
    `- Responsável atual: ${snapshot.ownerLabel} (${snapshot.owner})`,
  ];
  if (snapshot.pendingDecision) {
    lines.push(
      `- Próxima decisão: ${snapshot.pendingDecision.label} [${snapshot.pendingDecision.type}]`
    );
    if (snapshot.pendingDecision.dueAt) {
      lines.push(`- Prazo da decisão: ${snapshot.pendingDecision.dueAt}`);
    }
  } else {
    lines.push("- Próxima decisão: nenhuma pendente");
  }
  if (snapshot.stage) lines.push(`- Estágio: ${snapshot.stage}`);
  if (snapshot.patient) lines.push(`- Paciente: ${snapshot.patient.name}`);
  if (snapshot.appointment) {
    lines.push(
      `- Próxima consulta: ${snapshot.appointment.scheduledAt} (${snapshot.appointment.status})`
    );
  }
  if (snapshot.brief?.trim()) {
    lines.push(`- Brief do humano: ${snapshot.brief.trim()}`);
  }
  if (snapshot.operatorNotes?.trim()) {
    lines.push(`- Notas operacionais: ${snapshot.operatorNotes.trim()}`);
  }
  if (snapshot.owner !== "ai") {
    lines.push(
      `- REGRA: você NÃO deve responder; o responsável atual é ${snapshot.ownerLabel}.`
    );
  }
  return lines.join("\n");
}
