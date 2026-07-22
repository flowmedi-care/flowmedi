/**
 * Domain Event Bus — Event → (Transition ∥ Policy→Decision) → applyCaseCommands → Case
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCaseCommands } from "./apply-commands";
import { runAutomation } from "./automation/engine";
import { logPipelineStep } from "./observability";
import { buildPolicyBundle, evaluatePolicies } from "./policies";
import { aiMayPublishEvent } from "./policies/ai";
import {
  getCaseById,
  getOpenCaseByContact,
  insertCase,
  insertEvent,
} from "./repository";
import { applyEventTrigger } from "./transition/engine";
import type { CasePhase, CaseStatus, EventCategory, JourneyCase, ProcessTypeCode } from "./types";
import type { DomainEventType } from "./events";
import type { CaseCommand } from "./commands";

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
  clinicPolicyOverrides?: Parameters<typeof buildPolicyBundle>[0];
};

export type PublishEventResult = {
  eventId: string | null;
  case: JourneyCase | null;
  transitionApplied?: boolean;
  commandsApplied?: string[];
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
  const policies = buildPolicyBundle(input.clinicPolicyOverrides);

  // Invariant 2: AI never asserts domain facts
  if (input.actor === "ai" || input.actor.startsWith("ai:")) {
    if (!aiMayPublishEvent(policies.ai, input.eventType)) {
      return {
        eventId: null,
        case: null,
        rejected: "ai_intent_only_domain_facts_blocked",
      };
    }
  }

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

  await logPipelineStep(db, {
    clinicId: input.clinicId,
    caseId: journeyCase?.id ?? null,
    step: "DomainEvent.Received",
    sourceEventId: record.id,
    actor: input.actor,
    detail: { event_type: input.eventType, category },
  });

  if (category !== "domain" || !journeyCase) {
    return { eventId: record.id, case: journeyCase };
  }

  if (
    input.eventType === "case.phase_changed" ||
    input.eventType === "Case.PhaseChanged" ||
    input.eventType === "NotificationRequested"
  ) {
    return { eventId: record.id, case: journeyCase };
  }

  // Owner on existing case when actor is AI
  const preCommands: CaseCommand[] = [];
  if (
    (input.actor === "ai" || input.actor.startsWith("ai:")) &&
    journeyCase.owner_type !== "ai"
  ) {
    preCommands.push({
      type: "AssignOwner",
      caseId: journeyCase.id,
      owner: "ai",
    });
  }

  // Transition ∥ Policy (logical parallel — await both)
  const currentPhase = (journeyCase.phase as CasePhase | null) ?? null;

  const [transitionResult, policyResult] = await Promise.all([
    applyEventTrigger(db, journeyCase.id, input.eventType, input.actor),
    Promise.resolve(
      evaluatePolicies({
        eventType: input.eventType,
        currentPhase,
        actor: input.actor,
        policies,
      })
    ),
  ]);

  if (transitionResult.ok && transitionResult.emittedEventType === "case.phase_changed") {
    await logPipelineStep(db, {
      clinicId: input.clinicId,
      caseId: journeyCase.id,
      step: "Transition.Applied",
      sourceEventId: record.id,
      actor: input.actor,
      detail: {
        from: transitionResult.fromPhase?.code ?? null,
        to: transitionResult.toPhase.code,
      },
    });
    journeyCase = transitionResult.case;
  } else {
    await logPipelineStep(db, {
      clinicId: input.clinicId,
      caseId: journeyCase.id,
      step: "Transition.Skipped",
      sourceEventId: record.id,
      actor: input.actor,
      detail: {
        reason: transitionResult.ok
          ? transitionResult.emittedEventType
          : transitionResult.reason,
      },
    });
  }

  await logPipelineStep(db, {
    clinicId: input.clinicId,
    caseId: journeyCase.id,
    step: "Policy.Evaluated",
    sourceEventId: record.id,
    actor: input.actor,
    detail: {
      allowed: policyResult.allowed,
      reason: policyResult.reason ?? null,
      suggestedPhase: policyResult.suggestedPhase ?? null,
      confirmation_required: policies.clinic.requireAppointmentConfirmation,
      aiBlocked: policyResult.aiBlocked ?? false,
    },
  });

  if (!policyResult.allowed) {
    return {
      eventId: record.id,
      case: journeyCase,
      transitionApplied:
        transitionResult.ok &&
        transitionResult.emittedEventType === "case.phase_changed",
      rejected: policyResult.reason ?? "policy_blocked",
    };
  }

  const phaseAfter: CasePhase | null =
    (journeyCase.phase as CasePhase | null) ??
    (transitionResult.ok
      ? (transitionResult.toPhase.code as CasePhase)
      : currentPhase);

  const { commands: decisionCommands, appliedRuleIds } = runAutomation({
    eventType: input.eventType,
    caseId: journeyCase.id,
    currentPhase: phaseAfter,
    policy: policyResult,
    clinic: policies.clinic,
    payload: { ...input.payload, actor: input.actor },
    eventId: record.id,
  });

  await logPipelineStep(db, {
    clinicId: input.clinicId,
    caseId: journeyCase.id,
    step: "Decision.Created",
    sourceEventId: record.id,
    actor: input.actor,
    detail: {
      rule_ids: appliedRuleIds,
      command_types: decisionCommands.map((c) => c.type),
    },
  });

  await logPipelineStep(db, {
    clinicId: input.clinicId,
    caseId: journeyCase.id,
    step: "Automation.Applied",
    sourceEventId: record.id,
    actor: input.actor,
    detail: { rule_ids: appliedRuleIds },
  });

  const allCommands = [...preCommands, ...decisionCommands];
  const cmdResult = await applyCaseCommands(db, allCommands, {
    clinicId: input.clinicId,
    sourceEventId: record.id,
    actor: input.actor,
    skipSetPhase: true,
  });

  return {
    eventId: record.id,
    case: cmdResult.case ?? journeyCase,
    transitionApplied:
      transitionResult.ok &&
      transitionResult.emittedEventType === "case.phase_changed",
    commandsApplied: cmdResult.applied,
    rejected:
      !transitionResult.ok &&
      transitionResult.reason !== "no_matching_transition" &&
      cmdResult.applied.length === 0
        ? transitionResult.reason
        : undefined,
  };
}

export async function publishBusinessOutcome(
  db: SupabaseClient,
  input: Omit<PublishEventInput, "category"> & { eventType: DomainEventType | string }
): Promise<PublishEventResult> {
  return publishDomainEvent(db, { ...input, category: "domain" });
}

export async function rebuildCasePhase(): Promise<null> {
  return null;
}

export type { CaseStatus };
