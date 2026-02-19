import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/messages?conversationId=...
 * Lista mensagens de uma conversa. Verifica se a conversa pertence à clínica do usuário.
 */
export async function GET(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicMember();
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: conv, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("clinic_id", clinicId)
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select("id, direction, content, media_url, message_type, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true });

    if (error) {
      console.error("[WhatsApp Messages] Erro:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const messages = (rows || []).map((r: { content?: string; media_url?: string | null; message_type?: string; [k: string]: unknown }) => ({
      id: r.id,
      direction: r.direction,
      body: r.content ?? null,
      media_url: r.media_url ?? null,
      message_type: r.message_type ?? "text",
      sent_at: r.sent_at,
    }));
    return NextResponse.json(messages);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar mensagens";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
