import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRoutingOnNewConversation } from "@/lib/whatsapp-routing";
import { logAiEvent } from "./event-log";
import { sendAssistantReply, sendHandoffReply } from "./send-reply";

export type UserAiCommand = "opt_in" | "opt_out" | "handoff";

const HANDOFF_PATTERNS = [
  /falar com (um(a)? )?(atendente|humano|pessoa)/i,
  /quero (um )?atendente/i,
  /quero falar com (algu[eé]m|uma pessoa)/i,
  /\batendente humano\b/i,
  /reclama[çc][aã]o/,
];

const OPT_OUT_PATTERNS = [
  /desativ(e|ar)\b.*\b(respostas?\s+de\s+)?ia\b/i,
  /desativ(e|ar)\b.*\b(assistente|bot)\b/i,
  /\bparar\b.*\b(com\s+)?(a\s+)?ia\b/i,
  /\bsem\s+ia\b/i,
  /\bn[aã]o\s+quero\s+ia\b/i,
  /\bn[aã]o\s+quero\s+(assistente|bot|rob[oô])\b/i,
];

const OPT_IN_PATTERNS = [
  /^ativar(\s+(as\s+)?respostas?\s+de\s+ia)?\s*!?\s*$/i,
  /^ativar\s+ia\s*!?\s*$/i,
  /^ativar(\s+(o\s+)?(assistente|bot))?\s*!?\s*$/i,
];

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function parseUserAiCommand(text: string | null | undefined): UserAiCommand | null {
  const normalized = normalizeText(String(text ?? ""));
  if (!normalized) return null;

  if (OPT_IN_PATTERNS.some((p) => p.test(normalized))) {
    return "opt_in";
  }

  if (OPT_OUT_PATTERNS.some((p) => p.test(normalized))) {
    return "opt_out";
  }

  const lower = normalized.toLowerCase();
  if (HANDOFF_PATTERNS.some((p) => p.test(lower))) {
    return "handoff";
  }

  return null;
}

export interface HandleUserCommandResult {
  handled: boolean;
  command?: UserAiCommand;
  /** Se true, pode seguir para agendamento da IA após o comando */
  allowAiSchedule?: boolean;
}

export async function handleInboundUserCommand(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  messageId?: string;
  bodyText: string;
  humanHandoffEnabled?: boolean;
}): Promise<HandleUserCommandResult> {
  const command = parseUserAiCommand(opts.bodyText);
  if (!command) return { handled: false };

  const now = new Date().toISOString();

  if (command === "opt_out") {
    await opts.supabase
      .from("whatsapp_conversations")
      .update({
        ai_user_opt_out: true,
        ai_enabled: false,
        ai_handoff_at: null,
        ai_debounce_until: null,
      })
      .eq("id", opts.conversationId);

    if (opts.messageId) {
      await opts.supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("id", opts.messageId);
    }

    await sendAssistantReply(
      opts.supabase,
      opts.clinicId,
      opts.conversationId,
      opts.phoneNumber,
      "Pronto! Desativei as respostas automáticas. Quando quiser voltar, envie ATIVAR."
    );

    logAiEvent(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      messageId: opts.messageId,
      stage: "handoff",
      detail: { type: "user_opt_out", permanent: true },
    });

    return { handled: true, command, allowAiSchedule: false };
  }

  if (command === "opt_in") {
    await opts.supabase
      .from("whatsapp_conversations")
      .update({
        ai_user_opt_out: false,
        ai_handoff_at: null,
        ai_enabled: true,
        ai_debounce_until: null,
      })
      .eq("id", opts.conversationId);

    if (opts.messageId) {
      await opts.supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("id", opts.messageId);
    }

    await sendAssistantReply(
      opts.supabase,
      opts.clinicId,
      opts.conversationId,
      opts.phoneNumber,
      "Assistente reativado! Como posso ajudar?"
    );

    logAiEvent(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      messageId: opts.messageId,
      stage: "ai_reactivated",
      detail: { type: "user_opt_in", source: "patient_command" },
    });

    return { handled: true, command, allowAiSchedule: false };
  }

  if (command === "handoff") {
    if (opts.humanHandoffEnabled === false) {
      return { handled: false };
    }

    await opts.supabase
      .from("whatsapp_conversations")
      .update({
        ai_handoff_at: now,
        ai_enabled: false,
        ai_debounce_until: null,
      })
      .eq("id", opts.conversationId);

    await applyRoutingOnNewConversation(opts.supabase, opts.clinicId, opts.conversationId);

    if (opts.messageId) {
      await opts.supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("id", opts.messageId);
    }

    await sendHandoffReply(
      opts.supabase,
      opts.clinicId,
      opts.conversationId,
      opts.phoneNumber
    );

    logAiEvent(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      messageId: opts.messageId,
      stage: "handoff",
      detail: { type: "user_handoff", temporary: true },
    });

    return { handled: true, command, allowAiSchedule: false };
  }

  return { handled: false };
}
