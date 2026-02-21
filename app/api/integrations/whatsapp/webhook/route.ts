import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";
import { fetchAndStoreWhatsAppMedia } from "@/lib/whatsapp-media";

import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";
import {
  applyReferralRoutingIfMatch,
  applyRoutingOnNewConversation,
  handleChatbotMessage,
  sendChatbotReply,
} from "@/lib/whatsapp-routing";

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

        // Buscar access_token para mídia (image, audio, etc.)
        let accessToken: string | null = null;
        const { data: credsData } = await supabase
          .from("clinic_integrations")
          .select("credentials")
          .eq("clinic_id", clinicId)
          .in("integration_type", ["whatsapp_simple", "whatsapp_meta"])
          .eq("status", "connected")
          .limit(1)
          .maybeSingle();
        accessToken = (credsData?.credentials as { access_token?: string })?.access_token ?? null;

        // Buscar nome do contato do value.contacts (está no nível superior, não na mensagem)
        const contacts = (value.contacts as Array<{ profile?: { name?: string }; name?: { formatted_name?: string }; wa_id?: string }>) || [];
        const contactMap = new Map<string, string>();
        for (const contact of contacts) {
          const waId = contact.wa_id;
          const name = contact.profile?.name || contact.name?.formatted_name;
          if (waId && name) {
            // Normalizar wa_id para fazer match correto
            const normalizedWaId = normalizeWhatsAppPhone(waId.replace(/\D/g, ""));
            contactMap.set(normalizedWaId, String(name));
          }
        }

        for (const msg of messages) {
          const fromRaw = String((msg as { from?: string }).from ?? "").replace(/\D/g, "");
          if (!fromRaw) continue;
          const from = normalizeWhatsAppPhone(fromRaw);

          // Buscar nome do contato usando o from normalizado (deve fazer match com wa_id normalizado)
          let contactName: string | null = contactMap.get(from) || null;
          if (contactName) {
            console.log(`[WhatsApp Webhook] Nome do contato encontrado: ${contactName} para número ${from}`);
          }

          let bodyText: string | null = null;
          let mediaUrl: string | null = null;
          const text = (msg as { text?: { body?: string } }).text;
          const msgType = (msg as { type?: string }).type || "text";
          const image = (msg as { image?: { id?: string; mime_type?: string } }).image;
          const audio = (msg as { audio?: { id?: string; mime_type?: string } }).audio;
          const video = (msg as { video?: { id?: string; mime_type?: string } }).video;
          const document = (msg as { document?: { id?: string; mime_type?: string } }).document;

          if (text?.body) {
            bodyText = String(text.body);
          } else if (image?.id && accessToken) {
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              image.id,
              accessToken,
              supabase,
              { clinicId, mediaId: image.id, mimeType: image.mime_type }
            );
            bodyText = mediaUrl ? "" : "[image]";
          } else if (audio?.id && accessToken) {
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              audio.id,
              accessToken,
              supabase,
              { clinicId, mediaId: audio.id, mimeType: audio.mime_type }
            );
            bodyText = mediaUrl ? "" : "[audio]";
          } else if (video?.id && accessToken) {
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              video.id,
              accessToken,
              supabase,
              { clinicId, mediaId: video.id, mimeType: video.mime_type }
            );
            bodyText = mediaUrl ? "" : "[video]";
          } else if (document?.id && accessToken) {
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              document.id,
              accessToken,
              supabase,
              { clinicId, mediaId: document.id, mimeType: document.mime_type }
            );
            bodyText = mediaUrl ? "" : "[documento]";
          } else if (msgType) {
            bodyText = `[${msgType}]`;
          }

          const conversationRes = await supabase
            .from("whatsapp_conversations")
            .select("id, contact_name, status")
            .eq("clinic_id", clinicId)
            .eq("phone_number", from)
            .maybeSingle();

          const now = new Date().toISOString();
          let conversationId: string;
          let isNewConversation = false;
          if (conversationRes.data?.id) {
            conversationId = conversationRes.data.id;
            // Quando recebe mensagem inbound: atualizar last_inbound_message_at e reabrir se estiver fechada
            const updateData: Record<string, unknown> = {
              last_inbound_message_at: now,
              status: "open", // Reabre a conversa quando paciente envia mensagem
            };
            if (contactName) {
              updateData.contact_name = contactName;
            }
            const updateResult = await supabase
              .from("whatsapp_conversations")
              .update(updateData)
              .eq("id", conversationId);
            if (updateResult.error) {
              console.error("[WhatsApp Webhook] Erro ao atualizar conversa:", updateResult.error);
            }
          } else {
            const insertConv = await supabase
              .from("whatsapp_conversations")
              .insert({ 
                clinic_id: clinicId, 
                phone_number: from, 
                contact_name: contactName,
                status: "open",
                last_inbound_message_at: now
              })
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
              isNewConversation = true;
            } else {
              continue;
            }
          }

          if (isNewConversation) {
            const referred = await applyReferralRoutingIfMatch(
              supabase,
              clinicId,
              conversationId,
              bodyText ?? ""
            );
            if (!referred) {
              await applyRoutingOnNewConversation(supabase, clinicId, conversationId);
            }
          }

          const insertMsg = await supabase.from("whatsapp_messages").insert({
            conversation_id: conversationId,
            clinic_id: clinicId,
            direction: "inbound",
            message_type: msgType,
            content: bodyText ?? "",
            media_url: mediaUrl ?? null,
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
