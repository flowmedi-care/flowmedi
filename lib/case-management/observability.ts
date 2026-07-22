/**
 * Observabilidade do pipeline Case — timeline técnica em journey_events (internal).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { insertEvent } from "./repository";

export type PipelineStep =
  | "DomainEvent.Received"
  | "Transition.Applied"
  | "Transition.Skipped"
  | "Policy.Evaluated"
  | "Decision.Created"
  | "Automation.Applied"
  | "Command.Applied"
  | "Command.Rejected"
  | "Command.SkippedIdempotent"
  | "Case.Updated";

export async function logPipelineStep(
  db: SupabaseClient,
  input: {
    clinicId: string;
    caseId?: string | null;
    step: PipelineStep;
    sourceEventId?: string | null;
    actor?: string;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  await insertEvent(db, {
    clinic_id: input.clinicId,
    case_id: input.caseId ?? null,
    category: "internal",
    event_type: input.step,
    actor: input.actor ?? "system",
    payload: {
      source_event_id: input.sourceEventId ?? null,
      ...input.detail,
    },
  });
}
