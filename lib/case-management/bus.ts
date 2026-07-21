/**
 * Domain Event Bus — API pública de entrada.
 * Modules / IA / Humanos publicam aqui. Nunca mutam Case direto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { runAutomation } from "./automation/engine";
import {
  buildPolicyBundle,
  evaluatePolicies,
  type AIPolicyConfig,
  type ClinicPolicyConfig,
} from "./policies";
import {
  getCaseById,
  getOpenCaseByContact,
  insertCase,
  insertEvent,
  listDomainEventsForCase,
} from "./repository";
import { dispatchCommands } from "./transition/engine";
import type { CasePhase, EventCategory, JourneyCase, JourneyType } from "./types";
import { derivePhaseFromEventTypes } from "./policies/domain";
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
  /** Só Domain + Automation path. Integration/Internal só persistem. */
  clinicPolicy?: Partial<ClinicPolicyConfig> | null;
  aiPolicy?: Partial<AIPolicyConfig> | null;
  ensureCase?: {
    journey_type?: JourneyType;
    phase?: CasePhase;
  };
};

export type PublishEventResult = {
  eventId: string | null;
  case: JourneyCase | null;
  appliedRuleIds: string[];
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
        journey_type: input.ensureCase?.journey_type ?? "primeira_consulta",
        phase: input.ensureCase?.phase ?? "captacao",
        owner: input.actor.startsWith("ai") ? "ai" : "system",
      });
    }
  }
  return null;
}

/**
 * Publica evento no bus.
 * Domain → Policies → Automation → Commands → Transition.
 * Integration / Internal → apenas persist (+ consumers futuros).
 */
export async function publishDomainEvent(
  db: SupabaseClient,
  input: PublishEventInput
): Promise<PublishEventResult> {
  const category: EventCategory = input.category ?? "domain";
  const journeyCase = await resolveCase(db, input);

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
    return { eventId: null, case: journeyCase, appliedRuleIds: [], rejected: "persist_failed" };
  }

  if (category !== "domain") {
    return { eventId: record.id, case: journeyCase, appliedRuleIds: [] };
  }

  if (!journeyCase) {
    return { eventId: record.id, case: null, appliedRuleIds: [] };
  }

  const policies = buildPolicyBundle({
    clinic: input.clinicPolicy,
    ai: input.aiPolicy,
  });

  const overridePhase =
    input.eventType === "Case.OverrideRequested"
      ? (input.payload?.target_phase as CasePhase | undefined)
      : undefined;

  const policyResult = evaluatePolicies({
    eventType: input.eventType,
    currentPhase: journeyCase.phase,
    actor: input.actor,
    policies,
    overridePhase,
  });

  if (!policyResult.allowed) {
    await insertEvent(db, {
      clinic_id: input.clinicId,
      case_id: journeyCase.id,
      category: "internal",
      event_type: "Command.Rejected",
      actor: "system",
      payload: { reason: policyResult.reason, source_event: input.eventType },
    });
    return {
      eventId: record.id,
      case: journeyCase,
      appliedRuleIds: [],
      rejected: policyResult.reason,
    };
  }

  const { commands, appliedRuleIds } = runAutomation({
    eventType: input.eventType,
    caseId: journeyCase.id,
    currentPhase: journeyCase.phase,
    policy: policyResult,
    payload: input.payload ?? {},
    eventId: record.id,
  });

  if (appliedRuleIds.length) {
    await insertEvent(db, {
      clinic_id: input.clinicId,
      case_id: journeyCase.id,
      category: "internal",
      event_type: "Automation.Applied",
      actor: "system",
      payload: { rules: appliedRuleIds, source_event: input.eventType },
    });
  }

  const { results, followUpDomainEvents } = await dispatchCommands(
    db,
    commands,
    input.actor
  );

  for (const r of results) {
    if (!r.ok) {
      await insertEvent(db, {
        clinic_id: input.clinicId,
        case_id: journeyCase.id,
        category: "internal",
        event_type: "Command.Rejected",
        actor: "system",
        payload: { reason: r.reason },
      });
    }
  }

  // Intenção de módulo (ex. PaymentRequested) — NÃO executada pelo Transition.
  // Re-publica no bus como Domain Event para o Module Financeiro consumir.
  for (const fu of followUpDomainEvents) {
    if (fu.event_type === input.eventType) continue;
    await insertEvent(db, {
      clinic_id: input.clinicId,
      case_id: journeyCase.id,
      category: "domain",
      event_type: fu.event_type,
      actor: "system",
      payload: fu.payload ?? {},
    });
  }

  if (policyResult.suggestPaymentRequested) {
    const already = followUpDomainEvents.some((f) => f.event_type === "PaymentRequested");
    if (!already) {
      await insertEvent(db, {
        clinic_id: input.clinicId,
        case_id: journeyCase.id,
        category: "domain",
        event_type: "PaymentRequested",
        actor: "system",
        payload: { case_id: journeyCase.id, from: input.eventType },
      });
    }
  }

  const refreshed = await getCaseById(db, journeyCase.id);
  return {
    eventId: record.id,
    case: refreshed ?? journeyCase,
    appliedRuleIds,
  };
}

/** Alias tipado para Domain Events. */
export async function publishBusinessOutcome(
  db: SupabaseClient,
  input: Omit<PublishEventInput, "category"> & { eventType: DomainEventType | string }
): Promise<PublishEventResult> {
  return publishDomainEvent(db, { ...input, category: "domain" });
}

export async function rebuildCasePhase(
  db: SupabaseClient,
  caseId: string
): Promise<CasePhase | null> {
  const events = await listDomainEventsForCase(db, caseId);
  const phase = derivePhaseFromEventTypes(events.map((e) => e.event_type));
  const { updateCaseFields } = await import("./repository");
  await updateCaseFields(db, caseId, { phase });
  await insertEvent(db, {
    clinic_id: (await getCaseById(db, caseId))!.clinic_id,
    case_id: caseId,
    category: "internal",
    event_type: "Projection.Rebuilt",
    actor: "system",
    payload: { phase },
  });
  return phase;
}
