import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook do WhatsApp Cloud API (Meta).
 * GET: verificação pelo Meta (hub.mode, hub.verify_token, hub.challenge).
 * POST: eventos (mensagens, statuses). Responder 200 rapidamente.
 *
 * No painel Meta: WhatsApp > Configuração da API > Configurar webhook:
 *   URL: https://SEU_DOMINIO/api/integrations/whatsapp/webhook
 *   Token de verificação: mesmo valor de META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   Campos: messages, message_template_status_update (opcional: messaging_postbacks, etc.)
 */
const VERIFY_TOKEN = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Meta envia: { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    for (const entry of body.entry ?? []) {
      const phoneId = entry.id;
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id ?? phoneId;

        // Status updates (delivered, read, sent, failed)
        for (const status of value?.statuses ?? []) {
          console.log("[WhatsApp Webhook] status:", {
            phone_number_id: phoneNumberId,
            message_id: status.id,
            status: status.status,
            recipient_id: status.recipient_id,
            errors: status.errors,
          });

          // Atualizar status da mensagem no banco
          if (status.id) {
            await supabase
              .from("whatsapp_messages")
              .update({
                status: status.status === "delivered" ? "delivered" : status.status === "read" ? "read" : status.status === "failed" ? "failed" : "sent",
                delivered_at: status.status === "delivered" ? new Date().toISOString() : undefined,
                read_at: status.status === "read" ? new Date().toISOString() : undefined,
                error_message: status.errors?.[0]?.message || null,
              })
              .eq("message_id", status.id);
          }
        }

        // Mensagens recebidas
        for (const msg of value?.messages ?? []) {
          console.log("[WhatsApp Webhook] message:", {
            phone_number_id: phoneNumberId,
            from: msg.from,
            type: msg.type,
            id: msg.id,
          });

          // Encontrar clínica pelo phone_number_id
          const { data: integrations } = await supabase
            .from("clinic_integrations")
            .select("clinic_id, metadata")
            .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
            .eq("status", "connected");

          const integration = integrations?.find(
            (int) =>
              (int.metadata as { phone_number_id?: string })?.phone_number_id === phoneNumberId ||
              (int.metadata as { waba_id?: string })?.waba_id === phoneNumberId
          );

          if (!integration) {
            console.warn("[WhatsApp Webhook] Clínica não encontrada para phone_number_id:", phoneNumberId);
            continue;
          }

          const clinicId = integration.clinic_id;
          const phoneNumber = msg.from;
          const messageText = msg.text?.body || msg.type === "image" ? "[Imagem]" : msg.type === "audio" ? "[Áudio]" : msg.type === "video" ? "[Vídeo]" : msg.type === "document" ? "[Documento]" : "[Mensagem]";

          // Buscar ou criar conversa
          let { data: conversation } = await supabase
            .from("whatsapp_conversations")
            .select("id, unread_count")
            .eq("clinic_id", clinicId)
            .eq("phone_number", phoneNumber)
            .single();

          if (!conversation) {
            const { data: newConv } = await supabase
              .from("whatsapp_conversations")
              .insert({
                clinic_id: clinicId,
                phone_number: phoneNumber,
                contact_name: msg.profile?.name || null,
                last_message_preview: messageText,
                unread_count: 1,
              })
              .select("id, unread_count")
              .single();
            conversation = newConv;
          } else {
            // Atualizar conversa existente
            await supabase
              .from("whatsapp_conversations")
              .update({
                last_message_at: new Date().toISOString(),
                last_message_preview: messageText,
                unread_count: (conversation.unread_count || 0) + 1,
                contact_name: msg.profile?.name || undefined,
              })
              .eq("id", conversation.id);
          }

          if (!conversation?.id) continue;

          // Salvar mensagem
          await supabase.from("whatsapp_messages").insert({
            conversation_id: conversation.id,
            clinic_id: clinicId,
            message_id: msg.id,
            direction: "inbound",
            message_type: msg.type || "text",
            content: messageText,
            media_url: msg.image?.id || msg.video?.id || msg.audio?.id || msg.document?.id || null,
            status: "delivered",
            metadata: msg,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WhatsApp Webhook] Erro:", error);
    return NextResponse.json({ ok: true }); // Sempre retornar 200 para não bloquear webhook
  }
}
