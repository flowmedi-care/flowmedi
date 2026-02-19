import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";

import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

const VERIFY_TOKEN = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "flowmedi-verify";

/**
 * GET /api/integrations/whatsapp/webhook
 * Verificação do webhook pela Meta (hub.mode, hub.verify_token, hub.challenge).
 * URL que deve estar configurada no app Meta: https://www.flowmedi.com.br/api/integrations/whatsapp/webhook
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
 * POST /api/integrations/whatsapp/webhook
 * Recebe notificações da Meta (mensagens recebidas).
 * Marque o campo "messages" em "Campos do webhook" para receber as mensagens.
 */
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new NextResponse(null, { status: 200 });
  }

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
        if (change?.field !== "messages") continue;

        const value = change?.value;
        if (!value) continue;

        const phoneNumberId =
          (value.metadata as { phone_number_id?: string })?.phone_number_id;
        const messages = value.messages;

        if (!Array.isArray(messages) || messages.length === 0) continue;

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
          const fromRaw = String((msg as { from?: string }).from ?? "").replace(/\D/g, "");
          if (!fromRaw) continue;
          const from = normalizeWhatsAppPhone(fromRaw);

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
          if (conversationRes.data?.id) {
            conversationId = conversationRes.data.id;
          } else {
            const insertConv = await supabase
              .from("whatsapp_conversations")
              .insert({ clinic_id: clinicId, phone_number: from })
              .select("id")
              .single();
            if (insertConv.error) {
              if (insertConv.error.code === "23505") {
                const retry = await supabase
                  .from("whatsapp_conversations")
                  .select("id")
                  .eq("clinic_id", clinicId)
                  .eq("phone_number", from)
                  .maybeSingle();
                if (!retry.data?.id) { console.error("[WhatsApp Webhook] Erro ao criar conversa:", insertConv.error); continue; }
                conversationId = retry.data.id;
              } else {
                console.error("[WhatsApp Webhook] Erro ao criar conversa:", insertConv.error);
                continue;
              }
            } else if (insertConv.data?.id) {
              conversationId = insertConv.data.id;
            } else {
              continue;
            }
          }

          const insertMsg = await supabase.from("whatsapp_messages").insert({
            conversation_id: conversationId,
            clinic_id: clinicId,
            direction: "inbound",
            message_type: msgType || "text",
            content: bodyText ?? "",
            sent_at: new Date().toISOString(),
          } as Record<string, unknown>);

          if (insertMsg.error) {
            console.error("[WhatsApp Webhook] Erro ao inserir mensagem:", insertMsg.error);
          }
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Erro:", err);
  }
  return new NextResponse(null, { status: 200 });
}
