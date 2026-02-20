import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * POST /api/whatsapp/mark-viewed
 * Marca uma conversa como visualizada pelo usuário atual.
 * Body: { conversationId: string }
 */
export async function POST(request: Request) {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { conversationId } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId é obrigatório" }, { status: 400 });
    }

    // Verificar se a conversa pertence à clínica
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("clinic_id", clinicId)
      .single();

    if (!conv) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    // Upsert: atualizar ou criar registro de visualização
    const { error } = await supabase
      .from("whatsapp_conversation_views")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao marcar como visualizada";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
