import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * Lista mensagens de uma conversa
 * GET /api/whatsapp/conversations/[id]/messages
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const member = await requireClinicMember();
    const supabase = await createClient();

    // Verificar se a conversa pertence à clínica
    const conversationId = params.id;
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("clinic_id", member.clinicId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const { data: messages, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Marcar conversa como lida
    await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId);

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Erro ao listar mensagens:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar mensagens" },
      { status: 500 }
    );
  }
}
