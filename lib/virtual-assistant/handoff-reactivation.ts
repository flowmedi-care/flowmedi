import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldEscalateToHuman } from "./escalation";
import { getHandoffReactivationMinutes } from "./handoff-hours";
import { logAiEvent } from "./event-log";
import type { VirtualAssistantSettings } from "./types";
import { detectInboundIntent, hasClearIntent } from "./detect-inbound-intent";

/**
 * Reativa IA após handoff temporário se passou o SLA sem resposta humana
 * e a mensagem não é reclamação explícita.
 */
export async function tryReactivateAiAfterHandoff(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  bodyText: string;
  settings?: Partial<VirtualAssistantSettings> | null;
}): Promise<boolean> {
  const { data: conv } = await opts.supabase
    .from("whatsapp_conversations")
    .select("ai_handoff_at, ai_enabled, ai_user_opt_out")
    .eq("id", opts.conversationId)
    .maybeSingle();

  if (!conv?.ai_handoff_at || conv.ai_user_opt_out) return false;

  const complaint = shouldEscalateToHuman({ messageText: opts.bodyText });
  if (complaint.escalate && complaint.trigger === "complaint") return false;

  let settings = opts.settings;
  if (!settings) {
    const { data } = await opts.supabase
      .from("clinic_virtual_assistant_settings")
      .select("*")
      .eq("clinic_id", opts.clinicId)
      .maybeSingle();
    if (!data?.enabled) return false;
    settings = data as Partial<VirtualAssistantSettings>;
  }

  const minutes = getHandoffReactivationMinutes(settings);
  const handoffAt = new Date(conv.ai_handoff_at).getTime();
  const elapsedMin = (Date.now() - handoffAt) / 60_000;

  const { data: humanReply } = await opts.supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("conversation_id", opts.conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "human")
    .gt("sent_at", conv.ai_handoff_at)
    .limit(1)
    .maybeSingle();

  if (humanReply) return false;

  const intent = detectInboundIntent(opts.bodyText);
  const operationalFollowUp = hasClearIntent(intent) && intent !== "human_handoff";

  if (elapsedMin < minutes && !operationalFollowUp) return false;

  await opts.supabase
    .from("whatsapp_conversations")
    .update({
      ai_handoff_at: null,
      ai_enabled: true,
    })
    .eq("id", opts.conversationId);

  logAiEvent(opts.supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    stage: "ai_reactivated",
    detail: {
      source: operationalFollowUp ? "operational_follow_up" : "handoff_timeout",
      elapsedMinutes: Math.round(elapsedMin),
      thresholdMinutes: minutes,
      intent,
    },
  });

  return true;
}

export { isInsideHandoffWindow, handoffOutsideHoursMessage } from "./handoff-hours";
