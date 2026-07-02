import type { SupabaseClient } from "@supabase/supabase-js";
import { processConversationAi } from "@/lib/virtual-assistant/process-inbound";
import { logAgentRun } from "./agent-runs";

export type QueueAgentResult = {
  processed: number;
  total: number;
  errors: Array<{ conversationId: string; message: string }>;
  batches: number;
};

const MAX_BATCHES = 4;
const BATCH_SIZE = 50;

async function findPrioritizedConversationIds(
  supabase: SupabaseClient,
  clinicId: string,
  limit: number
): Promise<string[]> {
  const now = new Date().toISOString();

  const { data: stuck } = await supabase
    .from("whatsapp_conversations")
    .select("id, ai_debounce_until, updated_at")
    .eq("clinic_id", clinicId)
    .lte("ai_debounce_until", now)
    .is("ai_handoff_at", null)
    .eq("ai_user_opt_out", false)
    .neq("ai_enabled", false)
    .order("ai_debounce_until", { ascending: true })
    .limit(limit);

  const { data: pendingRows } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id, sent_at")
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .order("sent_at", { ascending: true })
    .limit(limit * 2);

  const { data: audioPending } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .eq("message_type", "audio")
    .is("ai_processed_at", null)
    .limit(limit);

  const { data: convsWithJobs } = await supabase
    .from("whatsapp_conversations")
    .select("id, ai_state")
    .eq("clinic_id", clinicId)
    .is("ai_handoff_at", null)
    .eq("ai_user_opt_out", false)
    .neq("ai_enabled", false);

  const scored = new Map<string, number>();

  for (const c of stuck ?? []) {
    scored.set(c.id, (scored.get(c.id) ?? 0) + 100);
  }

  for (const row of pendingRows ?? []) {
    if (!row.conversation_id) continue;
    const age = row.sent_at
      ? (Date.now() - new Date(row.sent_at).getTime()) / 60_000
      : 0;
    scored.set(row.conversation_id, (scored.get(row.conversation_id) ?? 0) + 50 + Math.min(age, 60));
  }

  for (const row of audioPending ?? []) {
    if (row.conversation_id) {
      scored.set(row.conversation_id, (scored.get(row.conversation_id) ?? 0) + 80);
    }
  }

  for (const c of convsWithJobs ?? []) {
    const jobs = (c.ai_state as { pending_transcription_jobs?: unknown[] } | null)
      ?.pending_transcription_jobs;
    if (Array.isArray(jobs) && jobs.length > 0) {
      scored.set(c.id, (scored.get(c.id) ?? 0) + 90);
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export async function runQueueAgent(
  supabase: SupabaseClient,
  clinicId: string
): Promise<QueueAgentResult> {
  const startedAt = Date.now();
  await logAgentRun(supabase, {
    clinicId,
    agentType: "queue",
    status: "running",
    action: "drain_queue",
  });

  const result: QueueAgentResult = {
    processed: 0,
    total: 0,
    errors: [],
    batches: 0,
  };

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const ids = await findPrioritizedConversationIds(supabase, clinicId, BATCH_SIZE);
    if (ids.length === 0) break;

    result.batches++;
    result.total += ids.length;

    await logAgentRun(supabase, {
      clinicId,
      agentType: "queue",
      status: "running",
      action: "process_batch",
      detail: { batch: batch + 1, count: ids.length },
    });

    for (const conversationId of ids) {
      try {
        await processConversationAi(supabase, conversationId);
        result.processed++;
      } catch (e) {
        result.errors.push({
          conversationId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (ids.length < BATCH_SIZE) break;
  }

  await logAgentRun(supabase, {
    clinicId,
    agentType: "queue",
    status: "done",
    action: "drain_queue",
    detail: {
      processed: result.processed,
      total: result.total,
      errors: result.errors.length,
      batches: result.batches,
    },
    durationMs: Date.now() - startedAt,
  });

  return result;
}
