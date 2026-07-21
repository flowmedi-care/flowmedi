/**
 * Transition Engine — aplica Transition do WorkflowVersion,
 * atualiza Case magro, emite Domain Event de saída (case.phase_changed).
 * NÃO chama módulos (Finance/Agenda/WhatsApp).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCaseById,
  getPhasesForVersion,
  getTransitionsForVersion,
  insertEvent,
  insertTask,
  updateCaseFields,
} from "../repository";
import type {
  JourneyCase,
  PendingDecision,
  TriggerType,
  WorkflowPhase,
  WorkflowTransition,
} from "../types";

export type ApplyTransitionInput = {
  caseId: string;
  actor: string;
  triggerType: TriggerType;
  /** Domain event type or null for manual */
  triggerRef?: string | null;
  /** Manual: target phase id */
  toPhaseId?: string | null;
  evidence?: string | null;
  setPendingDecision?: PendingDecision | null;
  clearPendingDecision?: boolean;
};

export type ApplyTransitionResult =
  | {
      ok: true;
      case: JourneyCase;
      fromPhase: WorkflowPhase | null;
      toPhase: WorkflowPhase;
      transitionId: string | null;
      emittedEventType: string;
    }
  | { ok: false; reason: string };

function findTransition(
  transitions: WorkflowTransition[],
  fromPhaseId: string | null,
  input: ApplyTransitionInput
): WorkflowTransition | null {
  const candidates = transitions.filter((t) => {
    if (fromPhaseId && t.from_phase_id !== fromPhaseId) return false;
    if (t.trigger_type !== input.triggerType) return false;
    if (input.triggerType === "manual") {
      if (input.toPhaseId && t.to_phase_id !== input.toPhaseId) return false;
      return true;
    }
    if (input.triggerRef && t.trigger_ref !== input.triggerRef) return false;
    return true;
  });
  return candidates[0] ?? null;
}

export async function applyTransition(
  db: SupabaseClient,
  input: ApplyTransitionInput
): Promise<ApplyTransitionResult> {
  const existing = await getCaseById(db, input.caseId);
  if (!existing) return { ok: false, reason: "case_not_found" };
  if (!existing.workflow_version_id) {
    return { ok: false, reason: "case_missing_workflow_version" };
  }

  const [phases, transitions] = await Promise.all([
    getPhasesForVersion(db, existing.workflow_version_id),
    getTransitionsForVersion(db, existing.workflow_version_id),
  ]);

  const fromPhase = phases.find((p) => p.id === existing.phase_id) ?? null;

  let transition = findTransition(transitions, existing.phase_id, input);

  // Manual override: allow DnD to any phase in same version if explicit toPhaseId
  if (!transition && input.triggerType === "manual" && input.toPhaseId) {
    const target = phases.find((p) => p.id === input.toPhaseId);
    if (!target) return { ok: false, reason: "target_phase_not_in_version" };
    // synthetic
    transition = {
      id: "manual-override",
      workflow_version_id: existing.workflow_version_id,
      from_phase_id: existing.phase_id ?? target.id,
      to_phase_id: target.id,
      trigger_type: "manual",
      trigger_ref: null,
      conditions: {},
      actions: [],
    };
  }

  if (!transition) return { ok: false, reason: "no_matching_transition" };

  const toPhase = phases.find((p) => p.id === transition!.to_phase_id);
  if (!toPhase) return { ok: false, reason: "to_phase_missing" };

  if (existing.phase_id === toPhase.id) {
    return {
      ok: true,
      case: existing,
      fromPhase,
      toPhase,
      transitionId: transition.id === "manual-override" ? null : transition.id,
      emittedEventType: "case.phase_unchanged",
    };
  }

  const patch: Parameters<typeof updateCaseFields>[2] = {
    phase_id: toPhase.id,
    phase: toPhase.code,
  };

  if (input.clearPendingDecision) patch.pending_decision = null;
  if (input.setPendingDecision !== undefined) {
    patch.pending_decision = input.setPendingDecision;
  }

  if (toPhase.terminal) {
    patch.status = toPhase.code === "perdido" ? "cancelled" : "completed";
    patch.closed_at = new Date().toISOString();
  }

  const updated = await updateCaseFields(db, input.caseId, patch);
  if (!updated) return { ok: false, reason: "update_failed" };

  // Emit Domain Event (saída) — consumers: notificações, analytics, IA
  await insertEvent(db, {
    clinic_id: updated.clinic_id,
    case_id: updated.id,
    category: "domain",
    event_type: "case.phase_changed",
    actor: input.actor,
    evidence: input.evidence ?? null,
    payload: {
      from_phase_id: fromPhase?.id ?? null,
      from_phase_code: fromPhase?.code ?? null,
      to_phase_id: toPhase.id,
      to_phase_code: toPhase.code,
      transition_id: transition.id === "manual-override" ? null : transition.id,
      trigger_type: input.triggerType,
      trigger_ref: input.triggerRef ?? null,
    },
  });

  // automation_policy on_enter — only create tasks / set pending via actions (no module calls)
  const { data: wv } = await db
    .from("workflow_versions")
    .select("automation_policy")
    .eq("id", existing.workflow_version_id)
    .maybeSingle();
  const policy = (wv?.automation_policy as { on_enter_phase?: Record<string, string[]> }) ?? {};
  const enterActions = policy.on_enter_phase?.[toPhase.code] ?? [];
  for (const action of enterActions) {
    if (action.startsWith("create_task:")) {
      const title = action.slice("create_task:".length) || "Tarefa";
      await insertTask(db, {
        case_id: updated.id,
        clinic_id: updated.clinic_id,
        title,
        type: "automation",
      });
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "Task.Created",
        actor: "system",
        payload: { title, from: "automation_policy" },
      });
    }
    // send_confirmation etc. → Domain Event de intenção (módulo reage)
    if (action === "send_confirmation") {
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "NotificationRequested",
        actor: "system",
        payload: { kind: "confirmation", phase: toPhase.code },
      });
    }
  }

  return {
    ok: true,
    case: updated,
    fromPhase,
    toPhase,
    transitionId: transition.id === "manual-override" ? null : transition.id,
    emittedEventType: "case.phase_changed",
  };
}

/** Aplica transição por Domain Event de entrada (Appointment.*, Lead.*, …) */
export async function applyEventTrigger(
  db: SupabaseClient,
  caseId: string,
  eventType: string,
  actor: string
): Promise<ApplyTransitionResult> {
  return applyTransition(db, {
    caseId,
    actor,
    triggerType: "event",
    triggerRef: eventType,
    evidence: eventType,
  });
}
