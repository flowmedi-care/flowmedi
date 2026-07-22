import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import type {
  ConversationOpsRow,
  MutatorResult,
  OperationsOwner,
  PendingDecision,
} from "./types";
import { ownerLabel, resolveOperationsOwner } from "./resolve-owner";
import {
  applyOwnerViaCase,
  applyPendingViaCase,
  projectConversationFromCase,
} from "./case-synchronizer";
import { getCaseById } from "@/lib/case-management/repository";

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
 * Lei Fonte Única: Case via Commands → project Conversation.
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

  const ownerUserId =
    input.owner === "human"
      ? input.clearAssignee
        ? null
        : input.ownerUserId ?? null
      : null;

  const result = await applyOwnerViaCase({
    supabase: input.supabase,
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    owner: input.owner,
    ownerUserId:
      input.owner === "human" ? ownerUserId ?? input.ownerUserId ?? null : null,
    actor: input.actorUserId ? `human:${input.actorUserId}` : "ops:mutator",
    reason: input.reason ?? null,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Falha ao atualizar responsável" };
  }

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: "ops_owner_changed",
    detail: {
      owner: input.owner,
      ownerUserId: input.ownerUserId ?? null,
      reason: input.reason ?? null,
      actorUserId: input.actorUserId ?? null,
      via: "case_commands",
    },
  });

  return {
    ok: true,
    data: {
      owner: input.owner,
      ownerUserId: input.owner === "human" ? input.ownerUserId ?? null : null,
    },
  };
}

/**
 * Claim: Case authority first; conflict if another human owns Case.
 */
export async function claimConversation(
  input: BaseInput & {
    claimantUserId: string;
    requireUnassigned?: boolean;
  }
): Promise<MutatorResult<{ ownerUserId: string }>> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };

  // Prefer Case owner when linked (Fonte Única)
  if (row.journey_case_id) {
    const journeyCase = await getCaseById(input.supabase, String(row.journey_case_id));
    if (
      journeyCase &&
      journeyCase.owner_type === "human" &&
      journeyCase.owner_id &&
      journeyCase.owner_id !== input.claimantUserId
    ) {
      const name = await resolveHumanLabel(input.supabase, journeyCase.owner_id);
      return {
        ok: false,
        error: `Atendimento já assumido por ${name || "outro usuário"}`,
        conflict: true,
        currentOwnerUserId: journeyCase.owner_id,
        currentOwnerLabel: ownerLabel("human", name),
      };
    }
    if (
      journeyCase &&
      journeyCase.owner_type === "human" &&
      journeyCase.owner_id === input.claimantUserId
    ) {
      await projectConversationFromCase({
        supabase: input.supabase,
        clinicId: input.clinicId,
        caseId: String(row.journey_case_id),
        conversationId: input.conversationId,
        reason: "claim_idempotent",
      });
      return { ok: true, data: { ownerUserId: input.claimantUserId } };
    }
  } else {
    const current = resolveOperationsOwner(row);
    if (current.owner === "human" && current.ownerUserId === input.claimantUserId) {
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
  }

  const result = await applyOwnerViaCase({
    supabase: input.supabase,
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    owner: "human",
    ownerUserId: input.claimantUserId,
    actor: `human:${input.claimantUserId}`,
    reason: input.reason || "claim",
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Falha ao assumir atendimento" };
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
    detail: {
      claimantUserId: input.claimantUserId,
      reason: input.reason || "claim",
      via: "case_commands",
    },
  });

  return { ok: true, data: { ownerUserId: input.claimantUserId } };
}

export async function setPendingDecision(
  input: BaseInput & { decision: PendingDecision | null }
): Promise<MutatorResult> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };

  const result = await applyPendingViaCase({
    supabase: input.supabase,
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    decision: input.decision,
    actor: input.actorUserId ? `human:${input.actorUserId}` : "ops:mutator",
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Falha ao atualizar pendência" };
  }
  return { ok: true, data: undefined };
}

export async function resolvePendingDecision(
  input: BaseInput & { status?: PendingDecision["status"] }
): Promise<MutatorResult> {
  // Clear on Case (resolved → ClearPendingDecision)
  return setPendingDecision({
    ...input,
    decision: null,
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
      via: "case_commands",
      actorUserId: input.actorUserId ?? null,
      hadBrief: Boolean(input.brief?.trim()),
    },
  });

  return result;
}

export async function pauseAiForHumanReply(
  input: BaseInput & { humanUserId: string }
): Promise<MutatorResult<{ owner: OperationsOwner; ownerUserId: string | null } | void>> {
  const row = await loadRow(input.supabase, input.conversationId, input.clinicId);
  if (!row) return { ok: false, error: "Conversa não encontrada" };

  if (row.journey_case_id) {
    const journeyCase = await getCaseById(input.supabase, String(row.journey_case_id));
    if (
      journeyCase &&
      journeyCase.owner_type === "human" &&
      journeyCase.owner_id &&
      journeyCase.owner_id !== input.humanUserId
    ) {
      // Outro humano conduz — só reforça projeção (IA pausada)
      await projectConversationFromCase({
        supabase: input.supabase,
        clinicId: input.clinicId,
        caseId: String(row.journey_case_id),
        conversationId: input.conversationId,
        reason: "human_reply_other_owner",
      });
      return { ok: true, data: undefined };
    }
  } else {
    const current = resolveOperationsOwner(row);
    if (
      current.owner === "human" &&
      current.ownerUserId &&
      current.ownerUserId !== input.humanUserId
    ) {
      return { ok: true, data: undefined };
    }
  }

  return setOwner({
    ...input,
    owner: "human",
    ownerUserId: input.humanUserId,
    pauseAi: true,
    reason: input.reason || "human_reply",
  });
}

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
