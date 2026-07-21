import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRoutingOnNewConversation } from "@/lib/whatsapp-routing";
import { logAiEvent } from "./event-log";
import { sendAssistantReply, sendHandoffReply } from "./send-reply";
import {
  handoffOutsideHoursMessage,
  isInsideHandoffWindow,
} from "./handoff-hours";
import {
  decideHandoff,
  mergeHandoffPolicy,
  type HandoffDecision,
} from "./policies/conversation/handoff-policy";
import type { VirtualAssistantSettings } from "./types";

export type UserAiCommand = "opt_in" | "opt_out" | "handoff";

const HANDOFF_PATTERNS = [
  /falar com (um(a)? )?(atendente|humano|pessoa)/i,
  /quero (um )?atendente/i,
  /quero falar com (algu[eé]m|uma pessoa)/i,
  /\batendente humano\b/i,
  /reclama[çc][aã]o/,
];

const OPT_OUT_PATTERNS = [
  /^desativ(e|ar)\s*!?\s*$/i,
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

async function applyTransferDecision(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  messageId?: string;
  decision: Extract<HandoffDecision, { action: "transfer" }>;
  setOptOut?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const { setOwner } = await import("@/lib/ops");
  await setOwner({
    supabase: opts.supabase,
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    owner: "human",
    ownerUserId: null,
    clearAssignee: true,
    pauseAi: opts.decision.pauseAi,
    reason: opts.decision.reason,
  });

  const patch: Record<string, unknown> = { ai_debounce_until: null };
  if (opts.setOptOut) patch.ai_user_opt_out = true;
  await opts.supabase
    .from("whatsapp_conversations")
    .update(patch)
    .eq("id", opts.conversationId);

  if (opts.decision.ownership === "assign_routing") {
    await applyRoutingOnNewConversation(
      opts.supabase,
      opts.clinicId,
      opts.conversationId
    );
  }

  if (opts.messageId) {
    await opts.supabase
      .from("whatsapp_messages")
      .update({ ai_processed_at: now })
      .eq("id", opts.messageId);
  }

  if (opts.decision.kind === "opt_out") {
    await sendAssistantReply(
      opts.supabase,
      opts.clinicId,
      opts.conversationId,
      opts.phoneNumber,
      opts.decision.patientReply
    );
  } else {
    await sendHandoffReply(
      opts.supabase,
      opts.clinicId,
      opts.conversationId,
      opts.phoneNumber,
      opts.decision.patientReply
    );
  }
}

export async function handleInboundUserCommand(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  messageId?: string;
  bodyText: string;
  humanHandoffEnabled?: boolean;
  vaSettings?: Partial<VirtualAssistantSettings> | null;
}): Promise<HandleUserCommandResult> {
  const command = parseUserAiCommand(opts.bodyText);
  if (!command) return { handled: false };

  const now = new Date().toISOString();
  const handoffPolicy = mergeHandoffPolicy({
    enabled: opts.humanHandoffEnabled !== false,
  });

  if (command === "opt_out") {
    const decision = decideHandoff(handoffPolicy, {
      trigger: "user_opt_out",
      insideHours: true,
      explicitHumanRequest: true,
    });
    if (decision.action !== "transfer") {
      return { handled: false };
    }

    await applyTransferDecision({
      supabase: opts.supabase,
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      messageId: opts.messageId,
      decision,
      setOptOut: true,
    });

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
        ai_debounce_until: null,
      })
      .eq("id", opts.conversationId);
    const { reactivateAi } = await import("@/lib/ops");
    await reactivateAi({
      supabase: opts.supabase,
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      reason: "user_opt_in",
    });

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
      "Voltei! Quer continuar de onde paramos ou é outro assunto?"
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
    const insideHours = opts.vaSettings
      ? isInsideHandoffWindow(opts.vaSettings)
      : true;

    const decision = decideHandoff(handoffPolicy, {
      trigger: "explicit_request",
      insideHours,
      explicitHumanRequest: true,
    });

    if (decision.action === "stay_with_ai") {
      const reply =
        decision.reason === "outside_handoff_hours" && opts.vaSettings
          ? handoffOutsideHoursMessage(opts.vaSettings)
          : decision.patientReply ??
            (opts.vaSettings
              ? handoffOutsideHoursMessage(opts.vaSettings)
              : "Posso continuar te ajudando por aqui.");
      await sendAssistantReply(
        opts.supabase,
        opts.clinicId,
        opts.conversationId,
        opts.phoneNumber,
        reply
      );
      if (opts.messageId) {
        await opts.supabase
          .from("whatsapp_messages")
          .update({ ai_processed_at: new Date().toISOString() })
          .eq("id", opts.messageId);
      }
      return { handled: true, command, allowAiSchedule: true };
    }

    await applyTransferDecision({
      supabase: opts.supabase,
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      messageId: opts.messageId,
      decision,
    });

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
