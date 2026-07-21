/**
 * Transition Engine — ÚNICO writer do Case Aggregate (+ Tasks).
 * NUNCA referencia Finance / Agenda / WhatsApp / Documentos / Prontuário.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseCommand } from "../commands";
import { TRANSITION_ALLOWED_COMMANDS } from "../commands";
import {
  completeTask,
  getCaseById,
  insertEvent,
  insertTask,
  updateCaseFields,
} from "../repository";
import type { JourneyCase } from "../types";

export type TransitionResult =
  | { ok: true; case: JourneyCase; followUpDomainEvents: FollowUpEvent[] }
  | { ok: false; reason: string };

export type FollowUpEvent = {
  event_type: string;
  payload?: Record<string, unknown>;
};

export async function dispatchCommand(
  db: SupabaseClient,
  command: CaseCommand,
  actor: string
): Promise<TransitionResult> {
  if (!TRANSITION_ALLOWED_COMMANDS.has(command.type)) {
    return { ok: false, reason: `command_not_allowed:${command.type}` };
  }

  const existing = await getCaseById(db, command.caseId);
  if (!existing) return { ok: false, reason: "case_not_found" };

  const followUp: FollowUpEvent[] = [];

  switch (command.type) {
    case "SetPhase": {
      if (existing.phase === command.phase) {
        return { ok: true, case: existing, followUpDomainEvents: [] };
      }
      const updated = await updateCaseFields(db, command.caseId, {
        phase: command.phase,
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "Case.PhaseChanged",
        actor,
        payload: {
          from: existing.phase,
          to: command.phase,
          reason: command.reason ?? null,
        },
      });
      if (command.phase === "financeiro") {
        followUp.push({
          event_type: "PaymentRequested",
          payload: { case_id: updated.id, reason: command.reason ?? "phase_financeiro" },
        });
      }
      return { ok: true, case: updated, followUpDomainEvents: followUp };
    }

    case "AssignOwner": {
      const updated = await updateCaseFields(db, command.caseId, {
        owner: command.owner,
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "Owner.Changed",
        actor,
        payload: { from: existing.owner, to: command.owner },
      });
      return { ok: true, case: updated, followUpDomainEvents: [] };
    }

    case "SetPendingDecision": {
      const updated = await updateCaseFields(db, command.caseId, {
        pending_decision: command.pending,
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "PendingDecision.Set",
        actor,
        payload: command.pending as unknown as Record<string, unknown>,
      });
      return { ok: true, case: updated, followUpDomainEvents: [] };
    }

    case "ClearPendingDecision": {
      const updated = await updateCaseFields(db, command.caseId, {
        pending_decision: null,
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "PendingDecision.Cleared",
        actor,
        payload: {},
      });
      return { ok: true, case: updated, followUpDomainEvents: [] };
    }

    case "OpenCase": {
      const updated = await updateCaseFields(db, command.caseId, {
        status: "open",
        closed_at: null,
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "Case.Opened",
        actor,
        payload: {},
      });
      return { ok: true, case: updated, followUpDomainEvents: [] };
    }

    case "CloseCase": {
      const updated = await updateCaseFields(db, command.caseId, {
        status: "closed",
        closed_at: new Date().toISOString(),
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "Case.Closed",
        actor,
        payload: { reason: command.reason ?? null },
      });
      return { ok: true, case: updated, followUpDomainEvents: [] };
    }

    case "ReopenCase": {
      const updated = await updateCaseFields(db, command.caseId, {
        status: "open",
        closed_at: null,
      });
      if (!updated) return { ok: false, reason: "update_failed" };
      await insertEvent(db, {
        clinic_id: updated.clinic_id,
        case_id: updated.id,
        category: "domain",
        event_type: "Case.Opened",
        actor,
        payload: { reopened: true },
      });
      return { ok: true, case: updated, followUpDomainEvents: [] };
    }

    case "CreateTask": {
      const task = await insertTask(db, {
        case_id: command.caseId,
        clinic_id: existing.clinic_id,
        title: command.title,
        assignee_role: command.assignee_role,
        due_at: command.due_at,
        source_event_id: command.source_event_id,
      });
      if (!task) return { ok: false, reason: "task_create_failed" };
      await insertEvent(db, {
        clinic_id: existing.clinic_id,
        case_id: existing.id,
        category: "domain",
        event_type: "Task.Created",
        actor,
        payload: { task_id: task.id, title: task.title },
      });
      return { ok: true, case: existing, followUpDomainEvents: [] };
    }

    case "CompleteTask": {
      const task = await completeTask(db, command.taskId);
      if (!task) return { ok: false, reason: "task_complete_failed" };
      await insertEvent(db, {
        clinic_id: existing.clinic_id,
        case_id: existing.id,
        category: "domain",
        event_type: "Task.Completed",
        actor,
        payload: { task_id: task.id },
      });
      return { ok: true, case: existing, followUpDomainEvents: [] };
    }

    default:
      return { ok: false, reason: "unknown_command" };
  }
}

export async function dispatchCommands(
  db: SupabaseClient,
  commands: CaseCommand[],
  actor: string
): Promise<{ results: TransitionResult[]; followUpDomainEvents: FollowUpEvent[] }> {
  const results: TransitionResult[] = [];
  const followUpDomainEvents: FollowUpEvent[] = [];
  for (const cmd of commands) {
    const r = await dispatchCommand(db, cmd, actor);
    results.push(r);
    if (r.ok) followUpDomainEvents.push(...r.followUpDomainEvents);
  }
  return { results, followUpDomainEvents };
}
