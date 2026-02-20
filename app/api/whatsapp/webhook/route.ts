import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";
import {
  applyRoutingOnNewConversation,
  handleChatbotMessage,
  sendChatbotReply,
} from "@/lib/whatsapp-routing";

const VERIFY_TOKEN = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "flowmedi-verify";

/**
 * GET /api/whatsapp/webhook
 * Verificação do webhook pela Meta: hub.mode, hub.verify_token, hub.challenge.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Recebe notificações da Meta (mensagens recebidas).
 * Usa service role para inserir no DB (webhook não tem usuário logado, RLS bloquearia).
 * Debug: payload completo é logado no servidor (ver logs na Vercel/servidor).
 */
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  // Debug: logar e armazenar para /api/whatsapp/webhook/debug
  try {
    const parsed = JSON.parse(rawBody);
    console.log("[WhatsApp Webhook] Payload recebido:", JSON.stringify(parsed, null, 2));
    setLastWebhookPayload(parsed);
  } catch {
    console.log("[WhatsApp Webhook] Body (raw):", rawBody?.slice(0, 2000));
    setLastWebhookPayload({ raw: rawBody?.slice(0, 2000) });
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const entry = body?.entry;
    if (!Array.isArray(entry) || entry.length === 0) {
      return new NextResponse(null, { status: 200 });
    }

    const supabase = createServiceRoleClient();

    for (const e of entry) {
      const changes = e?.changes;
      if (!Array.isArray(changes)) continue;

      for (const change of changes) {
        // Só processar eventos de mensagens (status/outros não têm value.messages)
        const field = change?.field;
        if (field !== "messages") continue;

        const value = change?.value;
        if (!value) continue;

        const phoneNumberId =
          (value.metadata && (value.metadata as { phone_number_id?: string }).phone_number_id) ??
          (value as { metadata?: { phone_number_id?: string } }).metadata?.phone_number_id;
        const messages = value.messages;

        if (!Array.isArray(messages) || messages.length === 0) continue;

        // Se não tiver phone_number_id no payload, buscar primeira integração conectada
        let clinicId: string | null = null;
        const { data: integrations } = await supabase
          .from("clinic_integrations")
          .select("clinic_id, metadata")
          .in("integration_type", ["whatsapp_simple", "whatsapp_meta"])
          .eq("status", "connected");

        if (phoneNumberId && integrations?.length) {
          const found = integrations.find(
            (i) => (i.metadata as { phone_number_id?: string })?.phone_number_id === phoneNumberId
          );
          clinicId = found?.clinic_id ?? null;
        }
        if (!clinicId && integrations?.length === 1) {
          clinicId = integrations[0].clinic_id;
        }
        if (!clinicId) {
          console.warn("[WhatsApp Webhook] Nenhuma clínica encontrada para phone_number_id:", phoneNumberId);
          continue;
        }

        for (const msg of messages) {
          const from = String((msg as { from?: string }).from ?? "").replace(/\D/g, "");
          if (!from) continue;

          let bodyText: string | null = null;
          const text = (msg as { text?: { body?: string } }).text;
          const msgType = (msg as { type?: string }).type;
          if (text?.body) bodyText = String(text.body);
          else if (msgType) bodyText = `[${msgType}]`;

          const conversationRes = await supabase
            .from("whatsapp_conversations")
            .select("id")
            .eq("clinic_id", clinicId)
            .eq("phone_number", from)
            .maybeSingle();

          let conversationId: string;
          let isNewConversation = false;
          if (conversationRes.data?.id) {
            conversationId = conversationRes.data.id;
          } else {
            const insertConv = await supabase
              .from("whatsapp_conversations")
              .insert({ clinic_id: clinicId, phone_number: from })
              .select("id")
              .single();
            if (insertConv.error) {
              console.error("[WhatsApp Webhook] Erro ao criar conversa:", insertConv.error);
              continue;
            }
            if (!insertConv.data?.id) continue;
            conversationId = insertConv.data.id;
            isNewConversation = true;
          }

          if (isNewConversation) {
            await applyRoutingOnNewConversation(supabase, clinicId, conversationId);
          }

          const insertMsg = await supabase.from("whatsapp_messages").insert({
            conversation_id: conversationId,
            clinic_id: clinicId,
            direction: "inbound",
            body: bodyText ?? "",
            sent_at: new Date().toISOString(),
          } as Record<string, unknown>);

          if (insertMsg.error) {
            console.error("[WhatsApp Webhook] Erro ao inserir mensagem:", insertMsg.error);
          }

          const chatbotResult = await handleChatbotMessage(
            supabase,
            clinicId,
            conversationId,
            from,
            bodyText ?? ""
          );
          if (chatbotResult.reply) {
            await sendChatbotReply(supabase, clinicId, conversationId, from, chatbotResult.reply);
          }
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Erro:", err);
  }
  return new NextResponse(null, { status: 200 });
}
