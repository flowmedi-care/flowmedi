import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * POST /api/whatsapp/close-expired
 * Fecha conversas que estão abertas há mais de 24h sem mensagem inbound.
 * Pode ser chamado por um cron job ou manualmente.
 */
export async function POST() {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();

    // Buscar conversas abertas onde última mensagem inbound foi há mais de 24h
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: expiredConversations, error: selectError } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("status", "open")
      .not("last_inbound_message_at", "is", null)
      .lt("last_inbound_message_at", twentyFourHoursAgo.toISOString());

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (!expiredConversations || expiredConversations.length === 0) {
      return NextResponse.json({ closed: 0, message: "Nenhuma conversa expirada" });
    }

    // Fechar todas as conversas expiradas
    const { error: updateError } = await supabase
      .from("whatsapp_conversations")
      .update({ status: "closed" })
      .eq("clinic_id", clinicId)
      .eq("status", "open")
      .not("last_inbound_message_at", "is", null)
      .lt("last_inbound_message_at", twentyFourHoursAgo.toISOString());

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      closed: expiredConversations.length,
      message: `${expiredConversations.length} conversa(s) fechada(s) automaticamente`
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao fechar conversas expiradas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
