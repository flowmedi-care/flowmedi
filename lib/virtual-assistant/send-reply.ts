import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";
import {
  ensurePatientVisibleMessage,
  HANDOFF_REPLY_BODY,
  resolveAssistantDisplayName,
  type WhatsAppSenderType,
} from "@/lib/whatsapp-sender-display";

export type OutboundWhatsAppSender = {
  sender_type: WhatsAppSenderType;
  sender_name: string;
  sender_user_id?: string | null;
};

async function getAssistantDisplayName(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string> {
  const { data } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("assistant_name")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return resolveAssistantDisplayName(data?.assistant_name);
}

async function persistOutboundMessage(
  supabase: SupabaseClient,
  opts: {
    conversationId: string;
    clinicId: string;
    content: string;
    sender: OutboundWhatsAppSender;
    aiProcessed?: boolean;
  }
): Promise<void> {
  await supabase.from("whatsapp_messages").insert({
    conversation_id: opts.conversationId,
    clinic_id: opts.clinicId,
    direction: "outbound",
    message_type: "text",
    content: opts.content,
    sent_at: new Date().toISOString(),
    ai_processed_at: opts.aiProcessed ? new Date().toISOString() : null,
    sender_type: opts.sender.sender_type,
    sender_name: opts.sender.sender_name,
    sender_user_id: opts.sender.sender_user_id ?? null,
  } as Record<string, unknown>);
}

export async function sendAssistantReply(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  phoneNumber: string,
  reply: string,
  opts?: { skipHeader?: boolean; assistantName?: string }
): Promise<boolean> {
  const displayName =
    opts?.assistantName ?? (await getAssistantDisplayName(supabase, clinicId));
  const visibleText = opts?.skipHeader
    ? reply.trim()
    : ensurePatientVisibleMessage(displayName, reply);

  const result = await sendWhatsAppMessage(
    clinicId,
    { to: phoneNumber, text: visibleText },
    false,
    supabase
  );

  if (result.success) {
    await persistOutboundMessage(supabase, {
      conversationId,
      clinicId,
      content: visibleText,
      sender: {
        sender_type: "assistant",
        sender_name: displayName,
      },
      aiProcessed: true,
    });
    return true;
  }

  console.error("[VirtualAssistant] send failed:", result.error);
  return false;
}

/** Mensagem padronizada ao transferir para atendimento humano. */
export async function sendHandoffReply(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  phoneNumber: string,
  body?: string
): Promise<boolean> {
  return sendAssistantReply(
    supabase,
    clinicId,
    conversationId,
    phoneNumber,
    body?.trim() || HANDOFF_REPLY_BODY
  );
}

export { getAssistantDisplayName };
