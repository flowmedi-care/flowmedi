import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppTicketStatus = "open" | "closed" | "completed";

export type ConversationTicketRow = {
  id: string;
  status: string | null;
  last_inbound_message_at: string | null;
};

export function getEffectiveTicketStatus(
  status: string | null | undefined,
  lastInboundAt: string | null | undefined,
  now = Date.now()
): WhatsAppTicketStatus {
  const normalized = String(status || "").toLowerCase();

  // "completed" é fechamento manual, não deve reabrir sozinho.
  if (normalized === "completed") return "completed";

  if (!lastInboundAt) return "closed";
  const inboundMs = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(inboundMs)) return "closed";

  const within24h = inboundMs >= now - 24 * 60 * 60 * 1000;
  return within24h ? "open" : "closed";
}

export async function getAndSyncEffectiveTicketStatus(
  clinicId: string,
  conversation: ConversationTicketRow | null,
  supabase: SupabaseClient,
  now = Date.now()
): Promise<WhatsAppTicketStatus | null> {
  if (!conversation) return null;

  const effective = getEffectiveTicketStatus(
    conversation.status,
    conversation.last_inbound_message_at,
    now
  );

  const current = String(conversation.status || "").toLowerCase();
  if (current !== effective) {
    await supabase
      .from("whatsapp_conversations")
      .update({ status: effective })
      .eq("id", conversation.id)
      .eq("clinic_id", clinicId);
  }

  return effective;
}
