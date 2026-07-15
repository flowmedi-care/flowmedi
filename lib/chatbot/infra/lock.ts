import type { SupabaseClient } from "@supabase/supabase-js";

export function isProcessingLockActive(
  aiState: Record<string, unknown>,
  maxAgeMs = 90_000
): boolean {
  const startedAt = aiState.ai_processing_started_at as string | undefined;
  if (!startedAt) return false;
  return Date.now() - new Date(startedAt).getTime() < maxAgeMs;
}

/** Keep claim stamp on every mid-turn / final ai_state write while the turn owns the lock. */
export function withProcessingLockStamp<T extends Record<string, unknown>>(
  state: T,
  lockStamp: string | undefined
): T {
  if (!lockStamp) return state;
  return { ...state, ai_processing_started_at: lockStamp };
}

export async function releaseProcessingLock(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("ai_state")
    .eq("id", conversationId)
    .maybeSingle();

  const current = (data?.ai_state ?? {}) as Record<string, unknown>;
  if (!current.ai_processing_started_at) return;

  const { ai_processing_started_at: _removed, ...rest } = current;
  await supabase
    .from("whatsapp_conversations")
    .update({ ai_state: rest })
    .eq("id", conversationId);
}

export type AcquireProcessingLockResult =
  | { ok: true; aiState: Record<string, unknown>; lockStamp: string }
  | { ok: false };

/**
 * Claim the conversation turn before any extract / mutation.
 * Returns the DB ai_state that includes the lock stamp.
 */
export async function tryAcquireProcessingLock(
  supabase: SupabaseClient,
  conversationId: string,
  maxAgeMs = 90_000
): Promise<AcquireProcessingLockResult> {
  const { data: row, error: readError } = await supabase
    .from("whatsapp_conversations")
    .select("ai_state")
    .eq("id", conversationId)
    .maybeSingle();

  if (readError || !row) return { ok: false };

  const current = (row.ai_state ?? {}) as Record<string, unknown>;
  const startedAt = current.ai_processing_started_at as string | undefined;

  if (startedAt && isProcessingLockActive(current, maxAgeMs)) {
    return { ok: false };
  }

  const now = new Date().toISOString();
  const nextState = { ...current, ai_processing_started_at: now };

  let updateQuery = supabase
    .from("whatsapp_conversations")
    .update({ ai_state: nextState })
    .eq("id", conversationId);

  if (startedAt) {
    updateQuery = updateQuery.eq("ai_state->>ai_processing_started_at", startedAt);
  } else {
    updateQuery = updateQuery.is("ai_state->>ai_processing_started_at", null);
  }

  const { data, error } = await updateQuery.select("id, ai_state").maybeSingle();
  if (error || !data) return { ok: false };

  const stamped = (data.ai_state ?? nextState) as Record<string, unknown>;
  return {
    ok: true,
    aiState: stamped,
    lockStamp: String(stamped.ai_processing_started_at ?? now),
  };
}

const recentReplyHashes = new Map<string, number>();
const REPLY_DEDUPE_TTL_MS = 30_000;

export function shouldSkipDuplicateReply(
  conversationId: string,
  inboundIds: string[],
  reply: string
): boolean {
  const key = `${conversationId}:${inboundIds.join(",")}:${reply.slice(0, 120)}`;
  const now = Date.now();
  const prev = recentReplyHashes.get(key);
  if (prev && now - prev < REPLY_DEDUPE_TTL_MS) return true;
  recentReplyHashes.set(key, now);
  for (const [k, ts] of recentReplyHashes) {
    if (now - ts > REPLY_DEDUPE_TTL_MS) recentReplyHashes.delete(k);
  }
  return false;
}
