/**
 * Única porta de mutação do Case Aggregate.
 * Idempotente por source_event_id + command_key.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseCommand, CaseCommandType } from "./commands";
import { TRANSITION_ALLOWED_COMMANDS } from "./commands";
import { logPipelineStep } from "./observability";
import {
  completeTask,
  getCaseById,
  insertTask,
  updateCaseFields,
} from "./repository";
import type { JourneyCase, OwnerType } from "./types";

export type ApplyCommandsContext = {
  clinicId: string;
  sourceEventId: string | null;
  actor: string;
  /** Quando true, SetPhase é ignorado (Transition Engine já é dono da fase). */
  skipSetPhase?: boolean;
};

export type ApplyCommandsResult = {
  case: JourneyCase | null;
  applied: string[];
  skipped: string[];
  rejected: string[];
};

export function commandKey(cmd: CaseCommand, sourceEventId: string | null): string {
  const base = `${cmd.type}:${cmd.caseId}`;
  const src = sourceEventId ?? "no_event";
  switch (cmd.type) {
    case "SetPendingDecision":
      return `${src}|${base}|${cmd.pending.type}|${cmd.pending.waiting_for}`;
    case "ClearPendingDecision":
      return `${src}|${base}|clear`;
    case "AssignOwner":
      return `${src}|${base}|${cmd.owner}`;
    case "CreateTask":
      return `${src}|${base}|${cmd.title}`;
    case "CompleteTask":
      return `${src}|${base}|${cmd.taskId}`;
    case "SetPhase":
      return `${src}|${base}|${cmd.phase}`;
    case "CloseCase":
      return `${src}|${base}|close|${cmd.reason ?? ""}`;
    case "OpenCase":
    case "ReopenCase":
      return `${src}|${base}|${cmd.type}`;
    default:
      return `${src}|${base}`;
  }
}

async function wasAlreadyApplied(
  db: SupabaseClient,
  caseId: string,
  key: string
): Promise<boolean> {
  const { data } = await db
    .from("journey_events")
    .select("id")
    .eq("case_id", caseId)
    .eq("category", "internal")
    .eq("event_type", "Command.Applied")
    .filter("payload->>command_key", "eq", key)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

function parseOwner(owner: string): { owner_type: OwnerType; owner_id: string | null; owner: string } {
  if (owner === "ai" || owner.startsWith("ai:")) {
    return { owner_type: "ai", owner_id: null, owner };
  }
  if (owner === "patient" || owner.startsWith("patient:")) {
    return { owner_type: "patient", owner_id: null, owner };
  }
  if (owner === "system" || owner.startsWith("system:")) {
    return { owner_type: "system", owner_id: null, owner };
  }
  if (owner.startsWith("human:")) {
    return { owner_type: "human", owner_id: owner.slice("human:".length) || null, owner };
  }
  if (owner === "human") {
    return { owner_type: "human", owner_id: null, owner };
  }
  return { owner_type: "human", owner_id: owner, owner: `human:${owner}` };
}

export async function applyCaseCommands(
  db: SupabaseClient,
  commands: CaseCommand[],
  ctx: ApplyCommandsContext
): Promise<ApplyCommandsResult> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const rejected: string[] = [];
  let lastCase: JourneyCase | null = null;

  for (const cmd of commands) {
    if (!TRANSITION_ALLOWED_COMMANDS.has(cmd.type as CaseCommandType)) {
      rejected.push(cmd.type);
      await logPipelineStep(db, {
        clinicId: ctx.clinicId,
        caseId: cmd.caseId,
        step: "Command.Rejected",
        sourceEventId: ctx.sourceEventId,
        actor: ctx.actor,
        detail: { reason: "command_not_allowed", command_type: cmd.type },
      });
      continue;
    }

    if (cmd.type === "SetPhase" && ctx.skipSetPhase) {
      skipped.push(commandKey(cmd, ctx.sourceEventId));
      continue;
    }

    const key = commandKey(cmd, ctx.sourceEventId);
    if (ctx.sourceEventId && (await wasAlreadyApplied(db, cmd.caseId, key))) {
      skipped.push(key);
      await logPipelineStep(db, {
        clinicId: ctx.clinicId,
        caseId: cmd.caseId,
        step: "Command.SkippedIdempotent",
        sourceEventId: ctx.sourceEventId,
        actor: ctx.actor,
        detail: { command_key: key, command_type: cmd.type },
      });
      continue;
    }

    const existing = await getCaseById(db, cmd.caseId);
    if (!existing) {
      rejected.push(key);
      await logPipelineStep(db, {
        clinicId: ctx.clinicId,
        caseId: cmd.caseId,
        step: "Command.Rejected",
        sourceEventId: ctx.sourceEventId,
        actor: ctx.actor,
        detail: { reason: "case_not_found", command_key: key },
      });
      continue;
    }

    let updated: JourneyCase | null = existing;
    let ok = true;

    switch (cmd.type) {
      case "SetPendingDecision": {
        updated = await updateCaseFields(db, cmd.caseId, {
          pending_decision: cmd.pending,
        });
        break;
      }
      case "ClearPendingDecision": {
        updated = await updateCaseFields(db, cmd.caseId, {
          pending_decision: null,
        });
        break;
      }
      case "AssignOwner": {
        const parsed = parseOwner(cmd.owner);
        updated = await updateCaseFields(db, cmd.caseId, {
          owner_type: parsed.owner_type,
          owner_id: parsed.owner_id,
          owner: parsed.owner,
        });
        break;
      }
      case "CreateTask": {
        const task = await insertTask(db, {
          case_id: cmd.caseId,
          clinic_id: existing.clinic_id,
          title: cmd.title,
          assignee_role: cmd.assignee_role,
          due_at: cmd.due_at,
          source_event_id: cmd.source_event_id ?? ctx.sourceEventId,
        });
        ok = Boolean(task);
        break;
      }
      case "CompleteTask": {
        const task = await completeTask(db, cmd.taskId);
        ok = Boolean(task);
        break;
      }
      case "CloseCase": {
        updated = await updateCaseFields(db, cmd.caseId, {
          status: "cancelled",
          closed_at: new Date().toISOString(),
          pending_decision: null,
        });
        break;
      }
      case "OpenCase": {
        updated = await updateCaseFields(db, cmd.caseId, {
          status: "active",
          closed_at: null,
        });
        break;
      }
      case "ReopenCase": {
        updated = await updateCaseFields(db, cmd.caseId, {
          status: "active",
          closed_at: null,
        });
        break;
      }
      case "SetPhase": {
        // Prefer Transition Engine; legacy string phase only as last resort
        updated = await updateCaseFields(db, cmd.caseId, {
          phase: cmd.phase,
        });
        break;
      }
      default:
        ok = false;
    }

    if (!ok || (cmd.type !== "CreateTask" && cmd.type !== "CompleteTask" && !updated)) {
      rejected.push(key);
      await logPipelineStep(db, {
        clinicId: ctx.clinicId,
        caseId: cmd.caseId,
        step: "Command.Rejected",
        sourceEventId: ctx.sourceEventId,
        actor: ctx.actor,
        detail: { reason: "apply_failed", command_key: key, command_type: cmd.type },
      });
      continue;
    }

    if (updated) lastCase = updated;
    applied.push(key);

    await logPipelineStep(db, {
      clinicId: ctx.clinicId,
      caseId: cmd.caseId,
      step: "Command.Applied",
      sourceEventId: ctx.sourceEventId,
      actor: ctx.actor,
      detail: {
        command_key: key,
        command_type: cmd.type,
        executed_at: new Date().toISOString(),
      },
    });

    await logPipelineStep(db, {
      clinicId: ctx.clinicId,
      caseId: cmd.caseId,
      step: "Case.Updated",
      sourceEventId: ctx.sourceEventId,
      actor: ctx.actor,
      detail: {
        via_command: cmd.type,
        command_key: key,
        pending_decision: updated?.pending_decision ?? null,
        owner_type: updated?.owner_type ?? null,
        status: updated?.status ?? null,
        phase: updated?.phase ?? null,
      },
    });
  }

  if (!lastCase && commands[0]) {
    lastCase = await getCaseById(db, commands[0].caseId);
  }

  return { case: lastCase, applied, skipped, rejected };
}
