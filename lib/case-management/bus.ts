/**
 * Domain Event Bus — persiste evento e dispara Transition Engine quando aplicável.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCaseById,
  getOpenCaseByContact,
  insertCase,
  insertEvent,
} from "./repository";
import { applyEventTrigger } from "./transition/engine";
import type { CaseStatus, EventCategory, JourneyCase, ProcessTypeCode } from "./types";
import type { DomainEventType } from "./events";

export type PublishEventInput = {
  clinicId: string;
  caseId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  patientId?: string | null;
  category?: EventCategory;
  eventType: string;
  actor: string;
  payload?: Record<string, unknown>;
  evidence?: string | null;
  ensureCase?: {
    process_type_code?: ProcessTypeCode;
  };
};

export type PublishEventResult = {
  eventId: string | null;
  case: JourneyCase | null;
  transitionApplied?: boolean;
  rejected?: string;
};

async function resolveCase(
  db: SupabaseClient,
  input: PublishEventInput
): Promise<JourneyCase | null> {
  if (input.caseId) return getCaseById(db, input.caseId);
  if (input.contactId) {
    const existing = await getOpenCaseByContact(db, input.clinicId, input.contactId);
    if (existing) return existing;
    if (input.ensureCase || input.eventType === "Conversation.Started") {
      return insertCase(db, {
        clinic_id: input.clinicId,
        contact_id: input.contactId,
        lead_id: input.leadId,
        patient_id: input.patientId,
        process_type_code: input.ensureCase?.process_type_code ?? "primeira_consulta",
        owner_type: input.actor.startsWith("ai") ? "ai" : "system",
      });
    }
  }
  return null;
}

export async function publishDomainEvent(
  db: SupabaseClient,
  input: PublishEventInput
): Promise<PublishEventResult> {
  const category: EventCategory = input.category ?? "domain";
  let journeyCase = await resolveCase(db, input);

  const record = await insertEvent(db, {
    clinic_id: input.clinicId,
    case_id: journeyCase?.id ?? input.caseId ?? null,
    category,
    event_type: input.eventType,
    actor: input.actor,
    payload: input.payload ?? {},
    evidence: input.evidence,
  });

  if (!record) {
    return { eventId: null, case: journeyCase, rejected: "persist_failed" };
  }

  if (category !== "domain" || !journeyCase) {
    return { eventId: record.id, case: journeyCase };
  }

  // Skip if this is already an output event from Transition Engine
  if (input.eventType === "case.phase_changed" || input.eventType === "NotificationRequested") {
    return { eventId: record.id, case: journeyCase };
  }

  const result = await applyEventTrigger(
    db,
    journeyCase.id,
    input.eventType,
    input.actor
  );

  if (result.ok) {
    return {
      eventId: record.id,
      case: result.case,
      transitionApplied: result.emittedEventType === "case.phase_changed",
    };
  }

  // no matching transition is OK (event still recorded)
  return {
    eventId: record.id,
    case: journeyCase,
    transitionApplied: false,
    rejected: result.reason === "no_matching_transition" ? undefined : result.reason,
  };
}

export async function publishBusinessOutcome(
  db: SupabaseClient,
  input: Omit<PublishEventInput, "category"> & { eventType: DomainEventType | string }
): Promise<PublishEventResult> {
  return publishDomainEvent(db, { ...input, category: "domain" });
}

export async function rebuildCasePhase(): Promise<null> {
  // Phase is UUID on versioned workflow — rebuild via event replay is a follow-up tool
  return null;
}

export type { CaseStatus };
