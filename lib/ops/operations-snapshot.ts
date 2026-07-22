import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationOpsRow,
  OperationsOwner,
  OperationsSnapshot,
  OwnershipHistoryEntry,
  PendingDecision,
} from "./types";
import { computeSla, ownerLabel, resolveOperationsOwner } from "./resolve-owner";
import { getCaseById } from "@/lib/case-management/repository";
import type { JourneyCase } from "@/lib/case-management/types";
import { ownerLabel as caseOwnerLabel } from "@/lib/case-management/types";

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

function casePendingToOps(
  pd: JourneyCase["pending_decision"]
): PendingDecision | null {
  if (!pd) return null;
  const waiting = (pd.waiting_for || "").toLowerCase();
  let owner: OperationsOwner = "human";
  if (waiting === "patient") owner = "patient_waiting";
  else if (waiting === "ai") owner = "ai";
  else if (waiting === "system") owner = "system";

  return {
    type: pd.type,
    label: pd.label?.trim() || pd.type,
    owner,
    priority: "normal",
    dueAt: pd.due_at ?? null,
    source: "journey",
    status: "pending",
    actions: [],
  };
}

function caseToOpsOwner(journeyCase: JourneyCase): {
  owner: OperationsOwner;
  ownerUserId: string | null;
} {
  if (journeyCase.owner_type === "ai") return { owner: "ai", ownerUserId: null };
  if (journeyCase.owner_type === "patient") {
    return { owner: "patient_waiting", ownerUserId: null };
  }
  if (journeyCase.owner_type === "system") return { owner: "system", ownerUserId: null };
  return { owner: "human", ownerUserId: journeyCase.owner_id };
}

export type SnapshotDeps = {
  assistantName?: string | null;
  assignedSecretaryName?: string | null;
  /** Nome do owner humano do Case (autoridade) */
  caseOwnerHumanName?: string | null;
  patientName?: string | null;
  appointment?: { id: string; scheduledAt: string; status: string } | null;
  stage?: string | null;
  journeyPendingDecision?: PendingDecision | null;
  /** Case authority when linked — Fonte Única */
  journeyCase?: JourneyCase | null;
  caseLoadWarning?: string | null;
  viewerUserId?: string | null;
  viewerIsAdmin?: boolean;
  now?: Date;
};

/**
 * Projeção operacional read-only.
 * Com journey_case_id + Case OK → Case é autoridade (Lei Fonte Única).
 */
export function buildOperationsSnapshot(
  row: ConversationOpsRow,
  deps: SnapshotDeps = {}
): OperationsSnapshot {
  const caseLoadWarning = deps.caseLoadWarning ?? null;
  const journeyCase = deps.journeyCase ?? null;

  let owner: OperationsOwner;
  let ownerUserId: string | null;
  let label: string;
  let pendingDecision: PendingDecision | null;

  if (journeyCase) {
    const mapped = caseToOpsOwner(journeyCase);
    owner = mapped.owner;
    ownerUserId = mapped.ownerUserId;
    label =
      owner === "ai"
        ? deps.assistantName?.trim() || "IA"
        : owner === "human"
          ? caseOwnerLabel(journeyCase, deps.caseOwnerHumanName) ||
            ownerLabel(owner, deps.caseOwnerHumanName)
          : ownerLabel(owner, null);
    pendingDecision = casePendingToOps(journeyCase.pending_decision);
  } else {
    const resolved = resolveOperationsOwner(row);
    owner = resolved.owner;
    ownerUserId = resolved.ownerUserId;
    const humanName = owner === "human" ? deps.assignedSecretaryName : null;
    label =
      owner === "ai"
        ? deps.assistantName?.trim() || "IA"
        : ownerLabel(owner, humanName);
    pendingDecision =
      parsePendingDecision(row.pending_decision) ?? deps.journeyPendingDecision ?? null;
  }

  const history = parseOwnershipHistory(row.ownership_history);
  if (history.length === 0) {
    history.push({
      at:
        row.ai_handoff_at ||
        row.assigned_at ||
        row.updated_at ||
        row.created_at ||
        new Date().toISOString(),
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
    canCompose =
      Boolean(viewerId) &&
      Boolean(ownerUserId) &&
      (viewerId === ownerUserId || isAdmin);
  }

  const patient = row.patient_id
    ? { id: row.patient_id, name: deps.patientName?.trim() || "Paciente" }
    : null;

  const aiEnabled =
    owner === "ai" &&
    row.ai_enabled !== false &&
    !row.ai_user_opt_out;

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
    aiEnabled,
    aiHandoffAt: row.ai_handoff_at ?? null,
    aiUserOptOut: Boolean(row.ai_user_opt_out),
    operatorNotes: row.operator_notes ?? null,
    brief: row.ops_brief ?? null,
    pipelineId: row.pipeline_id ?? null,
    journeyCaseId: row.journey_case_id
      ? String(row.journey_case_id)
      : journeyCase?.id ?? null,
    caseLoadWarning,
    sla,
    ownershipHistory: history,
    canCompose,
    conductorLabel: label,
  };
}

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

  let journeyCase: JourneyCase | null = null;
  let caseLoadWarning: string | null = null;
  let caseOwnerHumanName: string | null = null;

  if (conv.journey_case_id) {
    try {
      journeyCase = await getCaseById(supabase, String(conv.journey_case_id));
      if (!journeyCase) {
        caseLoadWarning = "CaseUnavailable";
        console.warn("[ops.snapshot] CaseUnavailable", {
          conversationId,
          journey_case_id: conv.journey_case_id,
        });
      } else if (journeyCase.owner_type === "human" && journeyCase.owner_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", journeyCase.owner_id)
          .maybeSingle();
        caseOwnerHumanName = prof?.full_name ?? null;
      }
    } catch (e) {
      caseLoadWarning = "CaseUnavailable";
      console.warn("[ops.snapshot] CaseUnavailable exception", e);
      journeyCase = null;
    }
  }

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
        conv.pipeline_id = lead.id;
      }
    }
  }

  const journeyStep = (conv.ai_state as { journey_step_code?: string } | null)
    ?.journey_step_code;
  if (!stage && journeyStep) stage = journeyStep;

  // CRM next_action só como fallback se Case ausente (sem autoridade Case)
  const journeyPendingDecision: PendingDecision | null =
    !journeyCase && !conv.pending_decision && leadNextAction
      ? {
          type: "crm_next_action",
          label: leadNextAction,
          owner: resolveOperationsOwner(conv).owner,
          priority: "normal",
          dueAt: null,
          source: "crm",
          status: "pending",
          actions: [{ id: "open_crm", label: "Abrir atendimento", kind: "navigate_crm" }],
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
    caseOwnerHumanName,
    patientName,
    appointment,
    stage,
    journeyPendingDecision,
    journeyCase,
    caseLoadWarning,
    viewerUserId: opts.viewerUserId,
    viewerIsAdmin: opts.viewerIsAdmin,
  });
}

export function formatOperationsSnapshotForPrompt(snapshot: OperationsSnapshot): string {
  const lines = [
    "Contexto operacional (respeite o responsável do Atendimento):",
    `- Responsável atual: ${snapshot.ownerLabel} (${snapshot.owner})`,
  ];
  if (snapshot.caseLoadWarning) {
    lines.push(`- AVISO: ${snapshot.caseLoadWarning} — usando projeção de emergência`);
  }
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
