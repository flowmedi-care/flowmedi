import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "./event-log";
import type { AiConversationState } from "./types";

const AUTOMATED_MESSAGE_PATTERNS = [
  /digite\s+\d/i,
  /escolha\s+(uma\s+)?op(ç|c)(ã|a)o/i,
  /menu\s+(principal|de\s+atendimento)/i,
  /bem[- ]vindo/i,
  /atendimento\s+autom(atizado|ático)/i,
  /resposta\s+autom(atizada|ática)/i,
  /(assistente|chat)\s*bot/i,
  /^\s*\d+\s*[-–—.)\]]\s/m,
  /para\s+(continuar|prosseguir),?\s+digite/i,
];

const PING_PONG_WINDOW_MS = 10 * 60 * 1000;
const PING_PONG_OUTBOUND_THRESHOLD = 4;
const SIMILAR_INBOUND_COUNT = 3;
const SIMILAR_INBOUND_MIN_LENGTH = 20;

export function looksLikeAutomatedMessage(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return AUTOMATED_MESSAGE_PATTERNS.some((p) => p.test(normalized));
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areSimilarMessages(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= SIMILAR_INBOUND_MIN_LENGTH && longer.startsWith(shorter.slice(0, 40))) {
    return true;
  }
  return false;
}

function hasSimilarInboundBurst(messages: string[]): boolean {
  if (messages.length < SIMILAR_INBOUND_COUNT) return false;
  const recent = messages.slice(-SIMILAR_INBOUND_COUNT);
  const first = recent[0];
  return recent.every((m) => areSimilarMessages(first, m));
}

export interface BotLoopCheckResult {
  block: boolean;
  reason?: string;
}

export async function checkBotLoopRisk(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string,
  inboundText: string
): Promise<BotLoopCheckResult> {
  const since = new Date(Date.now() - PING_PONG_WINDOW_MS).toISOString();

  const { data: recentOutbound } = await supabase
    .from("whatsapp_messages")
    .select("id, sent_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .gte("sent_at", since)
    .not("ai_processed_at", "is", null)
    .order("sent_at", { ascending: false });

  const outboundCount = recentOutbound?.length ?? 0;
  const inboundLooksAutomated = looksLikeAutomatedMessage(inboundText);

  if (outboundCount >= PING_PONG_OUTBOUND_THRESHOLD && inboundLooksAutomated) {
    return {
      block: true,
      reason: "ping_pong_with_automated_inbound",
    };
  }

  if (outboundCount >= PING_PONG_OUTBOUND_THRESHOLD + 1) {
    return {
      block: true,
      reason: "high_outbound_rate",
    };
  }

  const { data: recentInbound } = await supabase
    .from("whatsapp_messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(SIMILAR_INBOUND_COUNT);

  const inboundTexts = (recentInbound ?? [])
    .map((m) => String(m.content ?? "").trim())
    .filter(Boolean);

  if (inboundLooksAutomated && outboundCount >= 2) {
    return {
      block: true,
      reason: "automated_inbound_after_ai_replies",
    };
  }

  if (hasSimilarInboundBurst(inboundTexts)) {
    return {
      block: true,
      reason: "similar_inbound_burst",
    };
  }

  return { block: false };
}

export async function applyBotLoopSilence(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  messageIds?: string[];
  reason: string;
  aiState?: AiConversationState;
}): Promise<void> {
  const now = new Date().toISOString();
  const nextState: AiConversationState = {
    ...(opts.aiState ?? {}),
    bot_loop_detected_at: now,
  };

  await opts.supabase
    .from("whatsapp_conversations")
    .update({
      ai_handoff_at: now,
      ai_enabled: false,
      ai_debounce_until: null,
      ai_state: nextState,
    })
    .eq("id", opts.conversationId);

  if (opts.messageIds?.length) {
    await opts.supabase
      .from("whatsapp_messages")
      .update({ ai_processed_at: now })
      .in("id", opts.messageIds);
  } else {
    await opts.supabase
      .from("whatsapp_messages")
      .update({ ai_processed_at: now })
      .eq("conversation_id", opts.conversationId)
      .eq("direction", "inbound")
      .is("ai_processed_at", null);
  }

  logAiEvent(opts.supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    stage: "handoff",
    level: "warn",
    detail: { type: "bot_loop_detected", reason: opts.reason, silent: true },
  });
}

export async function quickBotLoopCheck(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string,
  inboundText: string
): Promise<BotLoopCheckResult> {
  if (!inboundText.trim()) return { block: false };
  if (!looksLikeAutomatedMessage(inboundText)) return { block: false };
  return checkBotLoopRisk(supabase, conversationId, clinicId, inboundText);
}
