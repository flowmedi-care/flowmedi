/**
 * Resolve qual Case ativo usar para uma conversa WhatsApp.
 * Nunca "adivinhar" ProcessType no Synchronizer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCaseById } from "./repository";
import { contactIdFromLead, contactIdFromPatient } from "./types";
import type { JourneyCase } from "./types";

export type ResolveConversationCaseInput = {
  clinicId: string;
  conversationId: string;
  /** Explicit link on conversation (preferred). */
  journeyCaseId?: string | null;
  patientId?: string | null;
  pipelineId?: string | null;
};

export type ResolveConversationCaseResult =
  | { ok: true; case: JourneyCase; via: "explicit" | "contact_recent" }
  | { ok: false; reason: "no_case" | "case_not_active" | "case_not_found" };

/**
 * Ordem:
 * 1. conversation.journey_case_id explícito
 * 2. Case active/waiting mais recente do contact (patient → lead)
 * 3. no_case (não cria Case aqui)
 */
export async function resolveActiveCaseForConversation(
  db: SupabaseClient,
  input: ResolveConversationCaseInput
): Promise<ResolveConversationCaseResult> {
  if (input.journeyCaseId) {
    const c = await getCaseById(db, input.journeyCaseId);
    if (!c) return { ok: false, reason: "case_not_found" };
    if (c.status !== "active" && c.status !== "waiting") {
      return { ok: false, reason: "case_not_active" };
    }
    return { ok: true, case: c, via: "explicit" };
  }

  const contactIds: string[] = [];
  if (input.patientId) contactIds.push(contactIdFromPatient(input.patientId));
  if (input.pipelineId) contactIds.push(contactIdFromLead(input.pipelineId));

  if (contactIds.length === 0) {
    return { ok: false, reason: "no_case" };
  }

  const { data } = await db
    .from("journey_cases")
    .select("*")
    .eq("clinic_id", input.clinicId)
    .in("contact_id", contactIds)
    .in("status", ["active", "waiting"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { ok: false, reason: "no_case" };

  const mapped = await getCaseById(db, String(data.id));
  if (!mapped) return { ok: false, reason: "case_not_found" };
  return { ok: true, case: mapped, via: "contact_recent" };
}

/** Persiste vínculo conversa → case quando ainda não existe. */
export async function linkConversationToCase(
  db: SupabaseClient,
  conversationId: string,
  caseId: string
): Promise<void> {
  await db
    .from("whatsapp_conversations")
    .update({ journey_case_id: caseId })
    .eq("id", conversationId);
}
