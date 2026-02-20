import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * POST /api/whatsapp/complete-conversation
 * Marca uma conversa como completed (concluída manualmente).
 * Body: { conversationId: string }
 */
export async function POST(request: Request) {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();
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

    // Marcar como completed
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ status: "completed" })
      .eq("id", conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao concluir conversa";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
