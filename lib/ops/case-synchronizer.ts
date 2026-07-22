/**
 * Case ↔ Conversation projection (Lei da Fonte Única).
 *
 * Escrita oficial:
 *   UI → applyCaseCommands → Case → projectConversationFromCase → Conversation
 *
 * Conversation nunca sobrescreve Case.
 * Helpers syncCase*FromConversation são legado — preferir apply*ViaCase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCaseCommands } from "../case-management/apply-commands";
import { getCaseById } from "../case-management/repository";
import {
  linkConversationToCase,
  resolveActiveCaseForConversation,
} from "../case-management/resolve-case";
import type { CaseCommand } from "../case-management/commands";
import type { JourneyCase, PendingDecision as CasePending } from "../case-management/types";
import type { OperationsOwner, OwnershipHistoryEntry, PendingDecision as OpsPending } from "./types";
import { ownerLabel as opsOwnerLabel } from "./resolve-owner";

function opsOwnerToCaseOwner(owner: OperationsOwner, ownerUserId?: string | null): string {
  if (owner === "ai") return "ai";
  if (owner === "patient_waiting") return "patient";
  if (owner === "system") return "system";
  if (ownerUserId) return `human:${ownerUserId}`;
  return "human";
}

function caseOwnerToOps(journeyCase: JourneyCase): {
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

function casePendingToOps(pd: CasePending | null): OpsPending | null {
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

function opsPendingToCase(decision: OpsPending | null): CasePending | null {
  if (!decision) return null;
  if (decision.status === "resolved" || decision.status === "cancelled") return null;
  return {
    type: decision.type,
    waiting_for:
      decision.owner === "patient_waiting"
        ? "patient"
        : decision.owner === "ai"
          ? "ai"
          : decision.owner === "human"
            ? "secretaria"
            : "system",
    label: decision.label,
    due_at: decision.dueAt,
  };
}

async function loadConversationMeta(
  db: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<{
  journey_case_id: string | null;
  patient_id: string | null;
  pipeline_id: string | null;
  ownership_history: unknown;
} | null> {
  const { data } = await db
    .from("whatsapp_conversations")
    .select("journey_case_id, patient_id, pipeline_id, ownership_history")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return null;
  return {
    journey_case_id: data.journey_case_id ? String(data.journey_case_id) : null,
    patient_id: data.patient_id ? String(data.patient_id) : null,
    pipeline_id: data.pipeline_id ? String(data.pipeline_id) : null,
    ownership_history: data.ownership_history,
  };
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

function appendHistory(
  existing: unknown,
  entry: OwnershipHistoryEntry
): OwnershipHistoryEntry[] {
  const prev = Array.isArray(existing) ? (existing as OwnershipHistoryEntry[]) : [];
  const last = prev[prev.length - 1];
  if (
    last &&
    last.owner === entry.owner &&
    last.ownerUserId === entry.ownerUserId &&
    last.reason === entry.reason
  ) {
    return prev;
  }
  return [...prev, entry].slice(-50);
}

/**
 * Materializa Case → Conversation (read model).
 * Alias: refreshConversationProjection
 */
export async function projectConversationFromCase(input: {
  supabase: SupabaseClient;
  clinicId: string;
  caseId: string;
  conversationId?: string | null;
  reason?: string | null;
}): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const journeyCase = await getCaseById(input.supabase, input.caseId);
  if (!journeyCase || journeyCase.clinic_id !== input.clinicId) {
    return { ok: false, error: "case_not_found" };
  }

  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    const { data: linked } = await input.supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("clinic_id", input.clinicId)
      .eq("journey_case_id", input.caseId)
      .maybeSingle();
    conversationId = linked?.id ? String(linked.id) : null;
  }
  if (!conversationId) {
    return { ok: true }; // no conversation to project — not an error
  }

  const meta = await loadConversationMeta(
    input.supabase,
    input.clinicId,
    conversationId
  );
  if (!meta) return { ok: false, error: "conversation_not_found" };

  const { owner, ownerUserId } = caseOwnerToOps(journeyCase);
  const humanName = await resolveHumanLabel(input.supabase, ownerUserId);
  const label = opsOwnerLabel(owner, humanName);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    journey_case_id: input.caseId,
    ops_owner_type: owner,
    ops_owner_user_id: ownerUserId,
    pending_decision: casePendingToOps(journeyCase.pending_decision),
    ownership_history: appendHistory(meta.ownership_history, {
      at: now,
      owner,
      ownerUserId,
      ownerLabel: label,
      reason: input.reason ?? "case_projection",
    }),
  };

  if (owner === "ai") {
    patch.ai_enabled = true;
    patch.ai_handoff_at = null;
    patch.assigned_secretary_id = null;
    patch.assigned_at = null;
  } else if (owner === "human") {
    patch.ai_enabled = false;
    patch.ai_handoff_at = now;
    if (ownerUserId) {
      patch.assigned_secretary_id = ownerUserId;
      patch.assigned_at = now;
    } else {
      patch.assigned_secretary_id = null;
      patch.assigned_at = null;
    }
  } else {
    patch.ai_enabled = false;
    patch.ai_handoff_at = now;
    patch.assigned_secretary_id = null;
    patch.assigned_at = null;
    patch.ops_owner_user_id = null;
  }

  const { error } = await input.supabase
    .from("whatsapp_conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("clinic_id", input.clinicId);

  if (error) {
    console.warn("[projectConversationFromCase]", error.message, {
      caseId: input.caseId,
      conversationId,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, conversationId };
}

/** Alias RFC */
export const refreshConversationProjection = projectConversationFromCase;

async function ensureCaseForConversation(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<{ ok: true; caseId: string } | { ok: false; reason: string }> {
  const meta = await loadConversationMeta(supabase, clinicId, conversationId);
  if (!meta) return { ok: false, reason: "conversation_not_found" };

  const resolved = await resolveActiveCaseForConversation(supabase, {
    clinicId,
    conversationId,
    journeyCaseId: meta.journey_case_id,
    patientId: meta.patient_id,
    pipelineId: meta.pipeline_id,
  });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  if (!meta.journey_case_id) {
    await linkConversationToCase(supabase, conversationId, resolved.case.id);
  }
  return { ok: true, caseId: resolved.case.id };
}

/** Apply AssignOwner on Case then project Conversation. */
export async function applyOwnerViaCase(input: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  owner: OperationsOwner;
  ownerUserId?: string | null;
  actor?: string;
  reason?: string | null;
}): Promise<{ ok: boolean; caseId?: string; error?: string }> {
  const ensured = await ensureCaseForConversation(
    input.supabase,
    input.clinicId,
    input.conversationId
  );
  if (!ensured.ok) return { ok: false, error: ensured.reason };

  const cmd: CaseCommand = {
    type: "AssignOwner",
    caseId: ensured.caseId,
    owner: opsOwnerToCaseOwner(input.owner, input.ownerUserId),
  };

  const applied = await applyCaseCommands(input.supabase, [cmd], {
    clinicId: input.clinicId,
    sourceEventId: null,
    actor: input.actor ?? "ops:mutator",
    skipSetPhase: true,
  });
  if (applied.rejected.length > 0 && applied.applied.length === 0) {
    return { ok: false, error: `rejected:${applied.rejected.join(",")}` };
  }

  const proj = await projectConversationFromCase({
    supabase: input.supabase,
    clinicId: input.clinicId,
    caseId: ensured.caseId,
    conversationId: input.conversationId,
    reason: input.reason ?? null,
  });
  if (!proj.ok) {
    console.warn("[applyOwnerViaCase] projection failed", proj.error);
  }

  return { ok: true, caseId: ensured.caseId };
}

/** Apply Set/Clear pending on Case then project. */
export async function applyPendingViaCase(input: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  decision: OpsPending | null;
  actor?: string;
}): Promise<{ ok: boolean; caseId?: string; error?: string }> {
  const ensured = await ensureCaseForConversation(
    input.supabase,
    input.clinicId,
    input.conversationId
  );
  if (!ensured.ok) return { ok: false, error: ensured.reason };

  const mapped = opsPendingToCase(input.decision);
  const cmd: CaseCommand = mapped
    ? { type: "SetPendingDecision", caseId: ensured.caseId, pending: mapped }
    : { type: "ClearPendingDecision", caseId: ensured.caseId };

  const applied = await applyCaseCommands(input.supabase, [cmd], {
    clinicId: input.clinicId,
    sourceEventId: null,
    actor: input.actor ?? "ops:mutator",
    skipSetPhase: true,
  });
  if (applied.rejected.length > 0 && applied.applied.length === 0) {
    return { ok: false, error: `rejected:${applied.rejected.join(",")}` };
  }

  const proj = await projectConversationFromCase({
    supabase: input.supabase,
    clinicId: input.clinicId,
    caseId: ensured.caseId,
    conversationId: input.conversationId,
    reason: "pending_projection",
  });
  if (!proj.ok) {
    console.warn("[applyPendingViaCase] projection failed", proj.error);
  }

  return { ok: true, caseId: ensured.caseId };
}

/** @deprecated use applyOwnerViaCase — Conversation must not overwrite Case */
export async function syncCaseOwnerFromConversation(input: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  owner: OperationsOwner;
  ownerUserId?: string | null;
  actor?: string;
}): Promise<{ synced: boolean; caseId?: string; reason?: string }> {
  const r = await applyOwnerViaCase({
    ...input,
    reason: "legacy_sync_owner",
  });
  return r.ok
    ? { synced: true, caseId: r.caseId }
    : { synced: false, reason: r.error };
}

/** @deprecated use applyPendingViaCase */
export async function syncCasePendingFromConversation(input: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  decision: OpsPending | null;
  actor?: string;
}): Promise<{ synced: boolean; caseId?: string; reason?: string }> {
  const r = await applyPendingViaCase(input);
  return r.ok
    ? { synced: true, caseId: r.caseId }
    : { synced: false, reason: r.error };
}
