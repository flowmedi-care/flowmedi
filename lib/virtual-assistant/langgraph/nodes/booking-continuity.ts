import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeOfferedBookingState } from "@/lib/booking-state";
import { getClinicTimezone } from "@/lib/clinic-timezone";
import { tryExecuteBookingSlotSelection } from "@/lib/operational-agents/booking-executor";
import { logAiEvent } from "../../event-log";
import { applyReplyGuards } from "../../reply-guards";
import {
  applyBookingContinuityStatePatch,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "../../booking-continuity-guards";
import type { GraphState } from "../state";
import { logLangGraphTrace } from "../trace";

export async function bookingContinuityNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const continuityIntent = resolveContinuityIntent(
    state.inboundText,
    state.aiState,
    state.detectedIntent
  );

  if (!shouldContinueBookingFlow(state.inboundText, continuityIntent, state.aiState)) {
    if (ctx) {
      logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
        node: "booking_continuity",
        handled: false,
        continuity_intent: continuityIntent,
        detected_intent: state.detectedIntent,
      });
    }
    return {};
  }

  const clinicTz = await getClinicTimezone(ctx.supabase, ctx.clinicId);
  let aiState = applyBookingContinuityStatePatch({
    ...state.aiState,
    ...sanitizeOfferedBookingState(state.aiState, clinicTz),
  });

  const slotExec = await tryExecuteBookingSlotSelection(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    phoneNumber: ctx.phoneNumber,
    messageText: state.inboundText,
    aiState,
  });

  if (!slotExec.handled) {
    if (ctx) {
      logAiEvent(ctx.supabase, {
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        stage: "booking_continuity",
        detail: {
          handled: false,
          selection_failed: true,
          continuity_intent: continuityIntent,
          detected_intent: state.detectedIntent,
          pipeline_stage: "agendamento",
          booking_step: aiState.booking_step ?? null,
          offered_slots_count: aiState.offered_slots?.length ?? 0,
          inbound_text: state.inboundText.slice(0, 500),
        },
      });
      logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
        node: "booking_continuity",
        handled: false,
        continuity_intent: continuityIntent,
        pipeline_stage: "agendamento",
      });
    }
    return {
      detectedIntent:
        continuityIntent === "availability_check" ? "availability_check" : "booking",
      aiState,
      pipelineStage: "agendamento",
    };
  }

  if (ctx) {
    logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
      node: "booking_continuity",
      handled: true,
      continuity_intent: continuityIntent,
      reply_source: "continuity",
      reply_preview: slotExec.reply.slice(0, 120),
    });
  }

  return {
    detectedIntent:
      continuityIntent === "availability_check" ? "availability_check" : "booking",
    aiState: { ...aiState, ...slotExec.statePatch },
    pipelineStage: "agendamento",
    reply: applyReplyGuards(slotExec.reply, aiState),
    replySource: "continuity",
    stageSubgraphComplete: true,
  };
}

export function routeAfterBookingContinuity(
  state: GraphState
): "handled" | "continue" {
  return state.stageSubgraphComplete && state.reply?.trim() ? "handled" : "continue";
}

/** Lock atômico para evitar processamento duplicado (webhook + cron). */
export function isProcessingLockActive(
  aiState: Record<string, unknown>,
  maxAgeMs = 90_000
): boolean {
  const startedAt = aiState.ai_processing_started_at as string | undefined;
  if (!startedAt) return false;
  return Date.now() - new Date(startedAt).getTime() < maxAgeMs;
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

export async function tryAcquireProcessingLock(
  supabase: SupabaseClient,
  conversationId: string,
  _aiState?: Record<string, unknown>,
  maxAgeMs = 90_000
): Promise<boolean> {
  const { data: row, error: readError } = await supabase
    .from("whatsapp_conversations")
    .select("ai_state")
    .eq("id", conversationId)
    .maybeSingle();

  if (readError || !row) return false;

  const current = (row.ai_state ?? {}) as Record<string, unknown>;
  const startedAt = current.ai_processing_started_at as string | undefined;

  if (startedAt && isProcessingLockActive(current, maxAgeMs)) {
    return false;
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

  const { data, error } = await updateQuery.select("id").maybeSingle();
  if (error || !data) return false;
  return true;
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
