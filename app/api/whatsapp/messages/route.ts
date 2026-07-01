import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { createAuthenticatedSignedUrl } from "@/lib/storage/signed-url";
import { WHATSAPP_MEDIA_BUCKET } from "@/lib/whatsapp-media";

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
      .select(
        "id, direction, content, media_url, message_type, sent_at, sender_type, sender_name, sender_user_id, ai_processed_at"
      )
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true });

    if (error) {
      console.error("[WhatsApp Messages] Erro:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const messages = await Promise.all(
      (rows || []).map(
        async (r: {
          content?: string;
          media_url?: string | null;
          message_type?: string;
          sender_type?: string | null;
          sender_name?: string | null;
          sender_user_id?: string | null;
          ai_processed_at?: string | null;
          [k: string]: unknown;
        }) => {
          let mediaUrl = r.media_url ?? null;
          if (mediaUrl) {
            const signed = await createAuthenticatedSignedUrl(
              supabase,
              WHATSAPP_MEDIA_BUCKET,
              mediaUrl
            );
            mediaUrl = signed.url ?? mediaUrl;
          }

          return {
            id: r.id,
            direction: r.direction,
            body: r.content ?? null,
            media_url: mediaUrl,
            message_type: r.message_type ?? "text",
            sent_at: r.sent_at,
            sender_type: r.sender_type ?? null,
            sender_name: r.sender_name ?? null,
            sender_user_id: r.sender_user_id ?? null,
            ai_processed_at: r.ai_processed_at ?? null,
          };
        }
      )
    );
    return NextResponse.json(messages);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar mensagens";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
