import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeOfferedBookingState } from "@/lib/booking-state";
import { getClinicTimezone } from "@/lib/clinic-timezone";
import { tryExecuteBookingSlotSelection } from "@/lib/operational-agents/booking-executor";
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
export async function tryAcquireProcessingLock(
  supabase: SupabaseClient,
  conversationId: string,
  aiState: Record<string, unknown>,
  maxAgeMs = 90_000
): Promise<boolean> {
  const startedAt = aiState.ai_processing_started_at as string | undefined;
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    if (elapsed < maxAgeMs) return false;
  }

  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const nextState = { ...aiState, ai_processing_started_at: now };

  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({ ai_state: nextState })
    .eq("id", conversationId)
    .or(`ai_state->>ai_processing_started_at.is.null,ai_state->>ai_processing_started_at.lt.${cutoff}`)
    .select("id")
    .maybeSingle();

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
