import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";

export async function sendAssistantReply(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  phoneNumber: string,
  reply: string
): Promise<boolean> {
  const result = await sendWhatsAppMessage(
    clinicId,
    { to: phoneNumber, text: reply },
    false,
    supabase
  );
  if (result.success) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      clinic_id: clinicId,
      direction: "outbound",
      message_type: "text",
      content: reply,
      sent_at: new Date().toISOString(),
      ai_processed_at: new Date().toISOString(),
    } as Record<string, unknown>);
    return true;
  }
  console.error("[VirtualAssistant] send failed:", result.error);
  return false;
}
