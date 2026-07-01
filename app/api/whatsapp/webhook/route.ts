import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";
import {
  applyReferralRoutingIfMatch,
  applyRoutingOnNewConversation,
  handleChatbotMessage,
  sendChatbotReply,
} from "@/lib/whatsapp-routing";
import {
  scheduleAiDebounce,
  shouldSkipMenuChatbot,
} from "@/lib/virtual-assistant/process-inbound";
import { handleInboundUserCommand } from "@/lib/virtual-assistant/user-commands";
import { applyBotLoopSilence, quickBotLoopCheck } from "@/lib/virtual-assistant/bot-loop-guard";
import { upsertWhatsappPipelineLead } from "@/lib/leads/upsert-whatsapp-lead";
import { parseMetaInboundMessage } from "@/lib/whatsapp-inbound-parse";
import { tryHandleInboundConfirmationFlow } from "@/lib/virtual-assistant/webhook-inbound-flow";
import {
  requireMetaWebhookVerifyToken,
  verifyMetaWebhookSignature,
} from "@/lib/meta-webhook-signature";

/**
 * GET /api/whatsapp/webhook
 * Verificação do webhook pela Meta: hub.mode, hub.verify_token, hub.challenge.
 */
export async function GET(request: NextRequest) {
  let verifyToken: string;
  try {
    verifyToken = requireMetaWebhookVerifyToken();
  } catch {
    console.error("[WhatsApp Webhook] META_WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado");
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
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

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("[WhatsApp Webhook] META_APP_SECRET não configurado");
    return new NextResponse("Webhook não configurado", { status: 500 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("[WhatsApp Webhook] Assinatura inválida ou ausente");
    return new NextResponse("Unauthorized", { status: 401 });
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
          .eq("integration_type", "whatsapp_meta")
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
          const from = normalizeWhatsAppPhone(fromRaw);
          if (!from) continue;

          let bodyText: string | null = null;
          const parsedInbound = parseMetaInboundMessage(msg as Record<string, unknown>);
          const msgType = parsedInbound.msgType;
          const flowInbound = parsedInbound.flowInbound;
          if (parsedInbound.bodyText || flowInbound) {
            bodyText = parsedInbound.bodyText;
          } else if (msgType) bodyText = `[${msgType}]`;

          const conversationRes = await supabase
            .from("whatsapp_conversations")
            .select("id")
            .eq("clinic_id", clinicId)
            .eq("phone_number", from)
            .maybeSingle();

          let conversationId: string;
          let isNewConversation = false;
          const now = new Date().toISOString();
          if (conversationRes.data?.id) {
            conversationId = conversationRes.data.id;
            await supabase
              .from("whatsapp_conversations")
              .update({
                status: "open",
                last_inbound_message_at: now,
              })
              .eq("id", conversationId);
          } else {
            const insertConv = await supabase
              .from("whatsapp_conversations")
              .insert({
                clinic_id: clinicId,
                phone_number: from,
                status: "open",
                last_inbound_message_at: now,
              })
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
            const contacts = (value as { contacts?: Array<{ profile?: { name?: string } }> }).contacts;
            const contactName = contacts?.[0]?.profile?.name ?? null;
            const msgReferral = (msg as { referral?: { source_type?: string; source_url?: string } }).referral;
            await upsertWhatsappPipelineLead(supabase, {
              clinicId,
              phone: from,
              name: contactName,
              referral: msgReferral ?? null,
            });

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

          const insertMsg = await supabase
            .from("whatsapp_messages")
            .insert({
              conversation_id: conversationId,
              clinic_id: clinicId,
              direction: "inbound",
              body: bodyText ?? "",
              sent_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .select("id")
            .single();

          if (insertMsg.error) {
            console.error("[WhatsApp Webhook] Erro ao inserir mensagem:", insertMsg.error);
          }

          const messageId = insertMsg.data?.id ?? undefined;

          const { data: vaSettingsRow } = await supabase
            .from("clinic_virtual_assistant_settings")
            .select("human_handoff_enabled, message_debounce_seconds")
            .eq("clinic_id", clinicId)
            .maybeSingle();

          if (flowInbound) {
            const flowHandled = await tryHandleInboundConfirmationFlow(supabase, {
              clinicId,
              conversationId,
              phoneNumber: from,
              messageId,
              flowInbound,
            });
            if (flowHandled.handled) {
              if (flowHandled.scheduleAi) {
                const debounceSec = Number(vaSettingsRow?.message_debounce_seconds) || 5;
                await scheduleAiDebounce(supabase, conversationId, clinicId, debounceSec, messageId);
              }
              continue;
            }
          }

          const commandResult = await handleInboundUserCommand({
            supabase,
            clinicId,
            conversationId,
            phoneNumber: from,
            messageId,
            bodyText: bodyText ?? "",
            humanHandoffEnabled: vaSettingsRow?.human_handoff_enabled !== false,
          });

          if (commandResult.handled) {
            continue;
          }

          const botLoop = await quickBotLoopCheck(
            supabase,
            conversationId,
            clinicId,
            bodyText ?? ""
          );
          if (botLoop.block) {
            await applyBotLoopSilence({
              supabase,
              clinicId,
              conversationId,
              messageIds: messageId ? [messageId] : undefined,
              reason: botLoop.reason ?? "webhook_prefilter",
            });
            continue;
          }

          const skipMenu = await shouldSkipMenuChatbot(supabase, clinicId, conversationId);
          if (skipMenu) {
            const debounceSec = Number(vaSettingsRow?.message_debounce_seconds) || 5;
            await scheduleAiDebounce(supabase, conversationId, clinicId, debounceSec, messageId);
          } else {
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
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Erro:", err);
  }
  return new NextResponse(null, { status: 200 });
}
