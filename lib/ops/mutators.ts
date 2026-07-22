import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import type {
  ConversationOpsRow,
  MutatorResult,
  OperationsOwner,
  OwnershipHistoryEntry,
  PendingDecision,
} from "./types";
import { ownerLabel, resolveOperationsOwner } from "./resolve-owner";

type BaseInput = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  actorUserId?: string | null;
  reason?: string;
};

const CONV_SELECT =
  "id, clinic_id, phone_number, contact_name, status, patient_id, assigned_secretary_id, assigned_at, ai_enabled, ai_handoff_at, ai_user_opt_out, last_inbound_message_at, created_at, updated_at, pipeline_id, operator_notes, ops_brief, pending_decision, ops_owner_type, ops_owner_user_id, ownership_history, ai_state, journey_case_id";

async function loadRow(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string
): Promise<ConversationOpsRow | null> {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select(CONV_SELECT)
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return (data as ConversationOpsRow) ?? null;
}

function appendHistory(
  existing: unknown,
  entry: OwnershipHistoryEntry
): OwnershipHistoryEntry[] {
  const prev = Array.isArray(existing) ? (existing as OwnershipHistoryEntry[]) : [];
  return [...prev, entry].slice(-50);
}

async function resolveHumanLabel(
  supabase: SupabaseClient,
  userId: string | null
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}

/**
 * Única porta para mudar o responsável.
 * Persiste flags IA + ops_owner_* + histórico.
 */
export async function setOwner(
  input: BaseInput & {
    owner: OperationsOwner;
    ownerUserId?: string | null;
    pauseAi?: boolean;
    clearAssignee?: boolean;
  }
): Promise<MutatorResult<{ owner: OperationsOwner; ownerUserId: string | null }>> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };

  const ownerUserId = input.ownerUserId ?? null;
  const humanName = await resolveHumanLabel(input.supabase, ownerUserId);
  const label = ownerLabel(input.owner, humanName);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    ops_owner_type: input.owner,
    ops_owner_user_id: ownerUserId,
    ownership_history: appendHistory(row.ownership_history, {
      at: now,
      owner: input.owner,
      ownerUserId,
      ownerLabel: label,
      reason: input.reason,
    }),
  };

  if (input.owner === "ai") {
    patch.ai_enabled = true;
    patch.ai_handoff_at = null;
    patch.assigned_secretary_id = null;
    patch.assigned_at = null;
  } else if (input.owner === "human") {
    patch.ai_enabled = false;
    patch.ai_handoff_at = row.ai_handoff_at || now;
    if (ownerUserId) {
      patch.assigned_secretary_id = ownerUserId;
      patch.assigned_at = now;
    } else if (input.clearAssignee) {
      patch.assigned_secretary_id = null;
      patch.assigned_at = null;
    }
  } else if (input.owner === "patient_waiting" || input.owner === "system") {
    // Sistema / aguardando paciente: IA pausada e sem assignee stale (claim livre)
    patch.ai_enabled = false;
    patch.ai_handoff_at = row.ai_handoff_at || now;
    patch.assigned_secretary_id = null;
    patch.assigned_at = null;
    patch.ops_owner_user_id = null;
  }

  if (input.pauseAi) {
    patch.ai_enabled = false;
    patch.ai_handoff_at = patch.ai_handoff_at || now;
  }

  const { error } = await input.supabase
    .from("whatsapp_conversations")
    .update(patch)
    .eq("id", input.conversationId)
    .eq("clinic_id", input.clinicId);

  if (error) return { ok: false, error: error.message };

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: "ops_owner_changed",
    detail: {
      owner: input.owner,
      ownerUserId,
      reason: input.reason ?? null,
      actorUserId: input.actorUserId ?? null,
    },
  });

  // Conversation → Case Synchronizer (responsibility, not schema merge)
  try {
    const { syncCaseOwnerFromConversation } = await import("./case-synchronizer");
    await syncCaseOwnerFromConversation({
      supabase: input.supabase,
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      owner: input.owner,
      ownerUserId,
      actor: input.actorUserId ? `human:${input.actorUserId}` : "ops:synchronizer",
    });
  } catch {
    /* Case sync best-effort */
  }

  return { ok: true, data: { owner: input.owner, ownerUserId } };
}

/**
 * Claim atômico: compare-and-set.
 * Primeiro commit vence; segundo recebe conflict.
 */
export async function claimConversation(
  input: BaseInput & {
    claimantUserId: string;
    /** Se omitido, exige assigned_secretary_id IS NULL */
    requireUnassigned?: boolean;
  }
): Promise<MutatorResult<{ ownerUserId: string }>> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };

  const current = resolveOperationsOwner(row);

  if (current.owner === "human" && current.ownerUserId === input.claimantUserId) {
    // Idempotente: garante IA pausada
    await input.supabase
      .from("whatsapp_conversations")
      .update({
        ai_enabled: false,
        ai_handoff_at: row.ai_handoff_at || new Date().toISOString(),
        ops_owner_type: "human",
        ops_owner_user_id: input.claimantUserId,
      })
      .eq("id", input.conversationId);
    return { ok: true, data: { ownerUserId: input.claimantUserId } };
  }

  if (
    current.owner === "human" &&
    current.ownerUserId &&
    current.ownerUserId !== input.claimantUserId
  ) {
    const name = await resolveHumanLabel(input.supabase, current.ownerUserId);
    return {
      ok: false,
      error: `Atendimento já assumido por ${name || "outro usuário"}`,
      conflict: true,
      currentOwnerUserId: current.ownerUserId,
      currentOwnerLabel: ownerLabel("human", name),
    };
  }

  const now = new Date().toISOString();
  const humanName = await resolveHumanLabel(input.supabase, input.claimantUserId);
  const label = ownerLabel("human", humanName);

  let query = input.supabase
    .from("whatsapp_conversations")
    .update({
      ai_enabled: false,
      ai_handoff_at: row.ai_handoff_at || now,
      assigned_secretary_id: input.claimantUserId,
      assigned_at: now,
      ops_owner_type: "human",
      ops_owner_user_id: input.claimantUserId,
      ownership_history: appendHistory(row.ownership_history, {
        at: now,
        owner: "human",
        ownerUserId: input.claimantUserId,
        ownerLabel: label,
        reason: input.reason || "claim",
      }),
    })
    .eq("id", input.conversationId)
    .eq("clinic_id", input.clinicId);

  // CAS: owner nativo + assignee esperados no momento do claim
  if (row.ops_owner_type) {
    query = query.eq("ops_owner_type", row.ops_owner_type);
  }
  if (
    current.owner === "ai" ||
    current.owner === "system" ||
    current.owner === "patient_waiting" ||
    (current.owner === "human" && !current.ownerUserId)
  ) {
    // Pool / não-humano: exige sem assignee (ou assignee já limpo)
    if (input.requireUnassigned !== false) {
      query = query.is("assigned_secretary_id", null);
    }
  } else if (row.assigned_secretary_id) {
    query = query.eq("assigned_secretary_id", row.assigned_secretary_id);
  }

  const { data: updated, error } = await query.select("id").maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (!updated) {
    const fresh = await loadRow(input.supabase, input.conversationId, input.clinicId);
    const freshOwner = fresh ? resolveOperationsOwner(fresh) : null;
    const name = freshOwner?.ownerUserId
      ? await resolveHumanLabel(input.supabase, freshOwner.ownerUserId)
      : null;
    return {
      ok: false,
      error: `Atendimento já assumido por ${name || "outro usuário"}`,
      conflict: true,
      currentOwnerUserId: freshOwner?.ownerUserId ?? null,
      currentOwnerLabel: name ? ownerLabel("human", name) : "Humano",
    };
  }

  await input.supabase
    .from("conversation_eligible_secretaries")
    .delete()
    .eq("conversation_id", input.conversationId);

  if (row.patient_id) {
    await input.supabase.from("patient_secretary").upsert(
      {
        clinic_id: input.clinicId,
        patient_id: row.patient_id,
        secretary_id: input.claimantUserId,
      },
      { onConflict: "clinic_id,patient_id,secretary_id" }
    );
  }

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: "ops_claimed",
    detail: { claimantUserId: input.claimantUserId, reason: input.reason || "claim" },
  });

  try {
    const { syncCaseOwnerFromConversation } = await import("./case-synchronizer");
    await syncCaseOwnerFromConversation({
      supabase: input.supabase,
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      owner: "human",
      ownerUserId: input.claimantUserId,
      actor: `human:${input.claimantUserId}`,
    });
  } catch {
    /* best-effort */
  }

  return { ok: true, data: { ownerUserId: input.claimantUserId } };
}

export async function setPendingDecision(
  input: BaseInput & { decision: PendingDecision | null }
): Promise<MutatorResult> {
  const { error } = await input.supabase
    .from("whatsapp_conversations")
    .update({ pending_decision: input.decision })
    .eq("id", input.conversationId)
    .eq("clinic_id", input.clinicId);
  if (error) return { ok: false, error: error.message };

  try {
    const { syncCasePendingFromConversation } = await import("./case-synchronizer");
    await syncCasePendingFromConversation({
      supabase: input.supabase,
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      decision: input.decision,
      actor: input.actorUserId ? `human:${input.actorUserId}` : "ops:synchronizer",
    });
  } catch {
    /* Case sync best-effort */
  }

  return { ok: true, data: undefined };
}

export async function resolvePendingDecision(
  input: BaseInput & { status?: PendingDecision["status"] }
): Promise<MutatorResult> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };
  const current = row.pending_decision as PendingDecision | null;
  if (!current || typeof current !== "object") {
    return { ok: true, data: undefined };
  }
  return setPendingDecision({
    ...input,
    decision: { ...current, status: input.status || "resolved" },
  });
}

export async function setBrief(input: BaseInput & { brief: string }): Promise<MutatorResult> {
  const { error } = await input.supabase
    .from("whatsapp_conversations")
    .update({ ops_brief: input.brief.trim() || null })
    .eq("id", input.conversationId)
    .eq("clinic_id", input.clinicId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function setOperatorNotes(
  input: BaseInput & { notes: string }
): Promise<MutatorResult> {
  const { error } = await input.supabase
    .from("whatsapp_conversations")
    .update({ operator_notes: input.notes.trim() || null })
    .eq("id", input.conversationId)
    .eq("clinic_id", input.clinicId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function setPatientWaiting(
  input: BaseInput
): Promise<MutatorResult<{ owner: OperationsOwner; ownerUserId: string | null }>> {
  return setOwner({
    ...input,
    owner: "patient_waiting",
    ownerUserId: null,
    reason: input.reason || "patient_waiting",
  });
}

export async function reactivateAi(
  input: BaseInput & { brief?: string | null }
): Promise<MutatorResult<{ owner: OperationsOwner; ownerUserId: string | null }>> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };
  if (row.ai_user_opt_out) {
    return {
      ok: false,
      error:
        "O paciente desativou respostas automáticas. Peça para enviar ATIVAR no WhatsApp.",
    };
  }

  if (input.brief?.trim()) {
    const briefRes = await setBrief({ ...input, brief: input.brief });
    if (!briefRes.ok) return briefRes;
  }

  const result = await setOwner({
    ...input,
    owner: "ai",
    ownerUserId: null,
    reason: input.reason || "reactivate_ai",
  });
  if (!result.ok) return result;

  await input.supabase
    .from("conversation_eligible_secretaries")
    .delete()
    .eq("conversation_id", input.conversationId);

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: "ai_reactivated",
    detail: {
      manual: true,
      via: "ops_mutator",
      actorUserId: input.actorUserId ?? null,
      hadBrief: Boolean(input.brief?.trim()),
    },
  });

  return result;
}

/** Pausa IA e assume (ou reforça) ownership humano após reply. */
export async function pauseAiForHumanReply(
  input: BaseInput & { humanUserId: string }
): Promise<MutatorResult<{ owner: OperationsOwner; ownerUserId: string | null } | void>> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };

  const current = resolveOperationsOwner(row);

  if (
    current.owner === "human" &&
    current.ownerUserId &&
    current.ownerUserId !== input.humanUserId
  ) {
    // Outro humano conduz — só garante IA pausada, não rouba claim
    await input.supabase
      .from("whatsapp_conversations")
      .update({
        ai_enabled: false,
        ai_handoff_at: row.ai_handoff_at || new Date().toISOString(),
      })
      .eq("id", input.conversationId);
    return { ok: true, data: undefined };
  }

  return setOwner({
    ...input,
    owner: "human",
    ownerUserId: input.humanUserId,
    pauseAi: true,
    reason: input.reason || "human_reply",
  });
}

/** Assign/transfer para secretária nomeada — sempre pausa IA. */
export async function assignToHuman(
  input: BaseInput & { secretaryId: string }
): Promise<MutatorResult<{ owner: OperationsOwner; ownerUserId: string | null }>> {
  const result = await setOwner({
    ...input,
    owner: "human",
    ownerUserId: input.secretaryId,
    pauseAi: true,
    reason: input.reason || "assign",
  });
  if (!result.ok) return result;

  await input.supabase
    .from("conversation_eligible_secretaries")
    .delete()
    .eq("conversation_id", input.conversationId);

  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (row?.patient_id) {
    await input.supabase.from("patient_secretary").upsert(
      {
        clinic_id: input.clinicId,
        patient_id: row.patient_id,
        secretary_id: input.secretaryId,
      },
      { onConflict: "clinic_id,patient_id,secretary_id" }
    );
  }

  return result;
}
