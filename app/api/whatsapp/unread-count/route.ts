import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/unread-count
 * Retorna o total de mensagens não lidas de todas as conversas da clínica.
 */
export async function GET() {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Buscar todas as conversas da clínica
    const { data: conversations } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("clinic_id", clinicId);

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ total: 0, byConversation: {} });
    }

    const conversationIds = conversations.map((c) => c.id);
    let totalUnread = 0;
    const byConversation: Record<string, number> = {};

    // Para cada conversa, contar mensagens não lidas
    for (const convId of conversationIds) {
      // Buscar última visualização do usuário
      const { data: view } = await supabase
        .from("whatsapp_conversation_views")
        .select("viewed_at")
        .eq("conversation_id", convId)
        .eq("user_id", user.id)
        .single();

      // Contar mensagens inbound enviadas após a última visualização
      const { count } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .eq("direction", "inbound")
        .gt("sent_at", view?.viewed_at || "1970-01-01");

      const unreadCount = count || 0;
      if (unreadCount > 0) {
        totalUnread += unreadCount;
        byConversation[convId] = unreadCount;
      }
    }

    return NextResponse.json({ total: totalUnread, byConversation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao contar não lidas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
