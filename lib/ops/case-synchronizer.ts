/**
 * Conversation → Case Synchronizer
 * Ops (conversa) informa responsabilidade; Case mantém estado do processo.
 * Sempre via applyCaseCommands — nunca update SQL no Case.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCaseCommands } from "../case-management/apply-commands";
import {
  linkConversationToCase,
  resolveActiveCaseForConversation,
} from "../case-management/resolve-case";
import type { CaseCommand } from "../case-management/commands";
import type { OperationsOwner } from "./types";
import type { PendingDecision as OpsPending } from "./types";

function opsOwnerToCaseOwner(owner: OperationsOwner, ownerUserId?: string | null): string {
  if (owner === "ai") return "ai";
  if (owner === "patient_waiting") return "patient";
  if (owner === "system") return "system";
  if (ownerUserId) return `human:${ownerUserId}`;
  return "human";
}

function opsPendingToCase(decision: OpsPending | null): {
  type: string;
  waiting_for: string;
  label?: string;
  due_at?: string | null;
} | null {
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
} | null> {
  const { data } = await db
    .from("whatsapp_conversations")
    .select("journey_case_id, patient_id, pipeline_id")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return null;
  return {
    journey_case_id: data.journey_case_id ? String(data.journey_case_id) : null,
    patient_id: data.patient_id ? String(data.patient_id) : null,
    pipeline_id: data.pipeline_id ? String(data.pipeline_id) : null,
  };
}

export async function syncCaseOwnerFromConversation(input: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  owner: OperationsOwner;
  ownerUserId?: string | null;
  actor?: string;
}): Promise<{ synced: boolean; caseId?: string; reason?: string }> {
  const meta = await loadConversationMeta(
    input.supabase,
    input.clinicId,
    input.conversationId
  );
  if (!meta) return { synced: false, reason: "conversation_not_found" };

  const resolved = await resolveActiveCaseForConversation(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    journeyCaseId: meta.journey_case_id,
    patientId: meta.patient_id,
    pipelineId: meta.pipeline_id,
  });

  if (!resolved.ok) return { synced: false, reason: resolved.reason };

  if (!meta.journey_case_id) {
    await linkConversationToCase(
      input.supabase,
      input.conversationId,
      resolved.case.id
    );
  }

  const cmd: CaseCommand = {
    type: "AssignOwner",
    caseId: resolved.case.id,
    owner: opsOwnerToCaseOwner(input.owner, input.ownerUserId),
  };

  await applyCaseCommands(input.supabase, [cmd], {
    clinicId: input.clinicId,
    sourceEventId: null,
    actor: input.actor ?? "ops:synchronizer",
    skipSetPhase: true,
  });

  return { synced: true, caseId: resolved.case.id };
}

export async function syncCasePendingFromConversation(input: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  decision: OpsPending | null;
  actor?: string;
}): Promise<{ synced: boolean; caseId?: string; reason?: string }> {
  const meta = await loadConversationMeta(
    input.supabase,
    input.clinicId,
    input.conversationId
  );
  if (!meta) return { synced: false, reason: "conversation_not_found" };

  const resolved = await resolveActiveCaseForConversation(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    journeyCaseId: meta.journey_case_id,
    patientId: meta.patient_id,
    pipelineId: meta.pipeline_id,
  });

  if (!resolved.ok) return { synced: false, reason: resolved.reason };

  if (!meta.journey_case_id) {
    await linkConversationToCase(
      input.supabase,
      input.conversationId,
      resolved.case.id
    );
  }

  const mapped = opsPendingToCase(input.decision);
  const cmd: CaseCommand = mapped
    ? {
        type: "SetPendingDecision",
        caseId: resolved.case.id,
        pending: mapped,
      }
    : { type: "ClearPendingDecision", caseId: resolved.case.id };

  await applyCaseCommands(input.supabase, [cmd], {
    clinicId: input.clinicId,
    sourceEventId: null,
    actor: input.actor ?? "ops:synchronizer",
    skipSetPhase: true,
  });

  return { synced: true, caseId: resolved.case.id };
}
