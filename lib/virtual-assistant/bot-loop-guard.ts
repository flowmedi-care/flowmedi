import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "./event-log";
import { sendHandoffReply } from "./send-reply";
import { isSlotSelectionMessage } from "@/lib/virtual-assistant/booking-slot-messages";
import type { AiConversationState, OfferedSlot } from "./types";

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

/** Resposta numérica curta a menu (1, 2, etc.) — não é bot automatizado. */
export function isMenuNumericReply(text: string): boolean {
  return /^\d{1,2}$/.test(text.trim());
}

export function looksLikeAutomatedMessage(text: string, aiState?: AiConversationState): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (isMenuNumericReply(normalized)) return false;
  if (aiState?.intent || aiState?.pending_step) {
    if (normalized.length <= 3) return false;
  }
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

const HANDOFF_REJECTION_PATTERNS = [
  /n[aã]o quero falar com (você|voce|atendente|humano|equipe|ningu[eé]m)/i,
  /quero falar com (você|voce) mesmo/i,
  /n[aã]o quero atendente/i,
];

function inboundRejectsHandoff(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return HANDOFF_REJECTION_PATTERNS.some((p) => p.test(normalized));
}

const IDENTICAL_OUTBOUND_THRESHOLD = 3;

export interface BotLoopCheckResult {
  block: boolean;
  reason?: string;
}

/** Estado mínimo para reiniciar a janela do bot-loop-guard após clear/reactivate. */
export function freshBotLoopWindowState(now = new Date()): Pick<AiConversationState, "bot_loop_window_since"> {
  return { bot_loop_window_since: now.toISOString() };
}

/** Início efetivo da janela: max(últimos N min, bot_loop_window_since). */
/** Slots may live under booking.* (chatbot) or legacy root offered_slots. */
export function resolveOfferedSlots(aiState?: AiConversationState): OfferedSlot[] {
  const root = aiState?.offered_slots ?? [];
  if (root.length) return root;
  return aiState?.booking?.offered_slots ?? [];
}

/** Menu numerado ativo (médico/procedimento/dia/horário) — escolha "1" não é loop. */
export function hasOfferedBookingMenu(aiState?: AiConversationState): boolean {
  if (!aiState) return false;
  if ((aiState.offered_doctors?.length ?? 0) > 0) return true;
  if ((aiState.offered_procedures?.length ?? 0) > 0) return true;
  if ((aiState.offered_days?.length ?? 0) > 0) return true;
  if ((resolveOfferedSlots(aiState).length ?? 0) > 0) return true;
  return false;
}

/**
 * Booking em andamento para isentar o loop guard.
 * Inclui núcleo incompleto (ex.: procedure sem doctor + lista de médicos).
 */
export function isActiveBookingForLoopGuard(aiState?: AiConversationState): boolean {
  if (hasOfferedBookingMenu(aiState)) return true;

  const booking = aiState?.booking;
  if (!booking || booking.status === "done") return false;

  if (booking.procedure_id || booking.doctor_id) {
    if (booking.status === "collecting" || booking.status === "confirming") {
      return true;
    }
  }

  if (!(booking.doctor_id && booking.procedure_id)) return false;
  return booking.status === "collecting" || booking.status === "confirming";
}

export function resolveBotLoopWindowSince(
  defaultSinceMs: number,
  aiState?: AiConversationState
): string {
  const resetAt = aiState?.bot_loop_window_since;
  if (!resetAt) {
    return new Date(defaultSinceMs).toISOString();
  }
  const resetMs = Date.parse(resetAt);
  if (Number.isNaN(resetMs)) {
    return new Date(defaultSinceMs).toISOString();
  }
  return new Date(Math.max(defaultSinceMs, resetMs)).toISOString();
}

export async function checkBotLoopRisk(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string,
  inboundText: string,
  aiState?: AiConversationState
): Promise<BotLoopCheckResult> {
  const offeredSlots = resolveOfferedSlots(aiState);
  const inActiveBookingSlotFlow =
    offeredSlots.length > 0 && isSlotSelectionMessage(inboundText.trim());

  if (inActiveBookingSlotFlow) {
    return { block: false };
  }

  if (isMenuNumericReply(inboundText) && isActiveBookingForLoopGuard(aiState)) {
    return { block: false };
  }

  if (inboundRejectsHandoff(inboundText)) {
    return { block: false };
  }

  const defaultSinceMs = Date.now() - PING_PONG_WINDOW_MS;
  const windowSince = resolveBotLoopWindowSince(defaultSinceMs, aiState);

  const { data: recentOutbound } = await supabase
    .from("whatsapp_messages")
    .select("id, sent_at, content")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .gte("sent_at", windowSince)
    .not("ai_processed_at", "is", null)
    .order("sent_at", { ascending: false });

  const outboundCount = recentOutbound?.length ?? 0;

  const outboundTexts = (recentOutbound ?? [])
    .map((m) => normalizeForCompare(String(m.content ?? "")))
    .filter(Boolean);
  if (
    outboundTexts.length >= IDENTICAL_OUTBOUND_THRESHOLD &&
    outboundTexts.slice(0, IDENTICAL_OUTBOUND_THRESHOLD).every((t) => t === outboundTexts[0])
  ) {
    return { block: false, reason: "identical_outbound_bot_fault" };
  }

  const inboundLooksAutomated = looksLikeAutomatedMessage(inboundText, aiState);

  if (outboundCount >= PING_PONG_OUTBOUND_THRESHOLD && inboundLooksAutomated) {
    return {
      block: true,
      reason: "ping_pong_with_automated_inbound",
    };
  }

  if (outboundCount >= PING_PONG_OUTBOUND_THRESHOLD + 1) {
    if (isActiveBookingForLoopGuard(aiState)) {
      return { block: false };
    }
    if (aiState?.intent === "booking" && offeredSlots.length > 0) {
      return { block: false };
    }
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
    .gte("sent_at", windowSince)
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
  phoneNumber?: string;
  messageIds?: string[];
  reason: string;
  aiState?: AiConversationState;
}): Promise<void> {
  const now = new Date().toISOString();
  const nextState: AiConversationState = {
    ...(opts.aiState ?? {}),
    bot_loop_detected_at: now,
    handoff_reason: "bot_loop_detected",
  };

  const { data: conv } = await opts.supabase
    .from("whatsapp_conversations")
    .select("phone_number")
    .eq("id", opts.conversationId)
    .maybeSingle();

  const phone = opts.phoneNumber ?? conv?.phone_number;
  if (phone) {
    const { applyRoutingOnNewConversation } = await import("@/lib/whatsapp-routing");
    await applyRoutingOnNewConversation(opts.supabase, opts.clinicId, opts.conversationId);
    await sendHandoffReply(opts.supabase, opts.clinicId, opts.conversationId, phone);
  }

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
    detail: { type: "bot_loop_detected", reason: opts.reason, silent: false },
  });
}

export async function quickBotLoopCheck(
  supabase: SupabaseClient,
  conversationId: string,
  clinicId: string,
  inboundText: string,
  aiState?: AiConversationState
): Promise<BotLoopCheckResult> {
  if (!inboundText.trim()) return { block: false };
  if (isMenuNumericReply(inboundText)) return { block: false };
  if (!looksLikeAutomatedMessage(inboundText, aiState)) return { block: false };
  return checkBotLoopRisk(supabase, conversationId, clinicId, inboundText, aiState);
}
