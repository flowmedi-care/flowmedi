import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "./event-log";

/**
 * Remove mensagem inbound da fila da IA sem enviar resposta do assistente virtual.
 */
export async function excludeInboundFromAiQueue(
  supabase: SupabaseClient,
  input: {
    clinicId: string;
    conversationId: string;
    messageId: string;
    reason: string;
    source: "routing" | "clear_queue" | "assistant_inactive";
  }
): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from("whatsapp_messages")
    .update({ ai_processed_at: now })
    .eq("id", input.messageId)
    .is("ai_processed_at", null);

  logAiEvent(supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    stage: "flow_discarded",
    level: "info",
    detail: {
      reason: input.reason,
      source: input.source,
    },
  });
}
