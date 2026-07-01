import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { toStoragePath } from "@/lib/storage/storage-ref";
import { WHATSAPP_MEDIA_BUCKET } from "@/lib/whatsapp-media";

/**
 * DELETE /api/whatsapp/delete-conversation?conversationId=...
 * Deleta uma conversa e todas as suas mensagens, incluindo mídias do storage.
 */
export async function DELETE(request: Request) {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

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

    // Buscar todas as mensagens com media_url para deletar do storage
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("media_url")
      .eq("conversation_id", conversationId)
      .not("media_url", "is", null);

    // Deletar arquivos do storage
    if (messages && messages.length > 0) {
      const filePaths = messages
        .map((m) => {
          const url = m.media_url as string;
          if (!url) return null;
          return toStoragePath(WHATSAPP_MEDIA_BUCKET, url);
        })
        .filter(Boolean) as string[];

      if (filePaths.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(WHATSAPP_MEDIA_BUCKET)
          .remove(filePaths);
        if (deleteError) {
          console.error("[Delete Conversation] Erro ao deletar mídias:", deleteError);
          // Continuar mesmo se houver erro ao deletar mídias
        }
      }
    }

    // Deletar conversa (cascade vai deletar mensagens e visualizações automaticamente)
    const { error } = await supabase
      .from("whatsapp_conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao deletar conversa";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
