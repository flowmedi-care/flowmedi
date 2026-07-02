import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";
import { fetchAndStoreWhatsAppMedia, normalizeMimeType } from "@/lib/whatsapp-media";
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
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import { excludeInboundFromAiQueue } from "@/lib/virtual-assistant/exclude-from-ai-queue";
import { parseMetaInboundMessage } from "@/lib/whatsapp-inbound-parse";
import { tryHandleInboundConfirmationFlow } from "@/lib/virtual-assistant/webhook-inbound-flow";
import { upsertWhatsappPipelineLead } from "@/lib/leads/upsert-whatsapp-lead";

/**
 * Processa payload inbound da Meta (mensagens, mídia, roteamento, chatbot, IA).
 * Deve rodar em background (waitUntil) após o webhook responder 200 à Meta.
 */
export async function processWhatsAppWebhookInbound(rawBody: string): Promise<void> {
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
      return;
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
          console.warn(
            "[WhatsApp Webhook] Nenhuma clínica encontrada para phone_number_id:",
            phoneNumberId
          );
          continue;
        }

        let accessToken: string | null = null;
        const { data: credsData } = await supabase
          .from("clinic_integrations")
          .select("credentials")
          .eq("clinic_id", clinicId)
          .eq("integration_type", "whatsapp_meta")
          .eq("status", "connected")
          .limit(1)
          .maybeSingle();
        accessToken = (credsData?.credentials as { access_token?: string })?.access_token ?? null;

        const contacts =
          (value.contacts as Array<{
            profile?: { name?: string };
            name?: { formatted_name?: string };
            wa_id?: string;
          }>) || [];
        const contactMap = new Map<string, string>();
        for (const contact of contacts) {
          const waId = contact.wa_id;
          const name = contact.profile?.name || contact.name?.formatted_name;
          if (waId && name) {
            const normalizedWaId = normalizeWhatsAppPhone(waId.replace(/\D/g, ""));
            contactMap.set(normalizedWaId, String(name));
          }
        }

        for (const msg of messages) {
          const fromRaw = String((msg as { from?: string }).from ?? "").replace(/\D/g, "");
          if (!fromRaw) continue;
          const from = normalizeWhatsAppPhone(fromRaw);

          let contactName: string | null = contactMap.get(from) || null;
          if (contactName) {
            console.log(
              `[WhatsApp Webhook] Nome do contato encontrado: ${contactName} para número ${from}`
            );
          }

          let bodyText: string | null = null;
          let mediaUrl: string | null = null;
          let mediaMimeType: string | null = null;
          const parsedInbound = parseMetaInboundMessage(msg as Record<string, unknown>);
          const msgType = parsedInbound.msgType;
          const flowInbound = parsedInbound.flowInbound;
          const image = (msg as { image?: { id?: string; mime_type?: string } }).image;
          const audio = (msg as { audio?: { id?: string; mime_type?: string } }).audio;
          const video = (msg as { video?: { id?: string; mime_type?: string } }).video;
          const document = (msg as { document?: { id?: string; mime_type?: string } }).document;

          if (parsedInbound.bodyText || flowInbound) {
            bodyText = parsedInbound.bodyText;
          } else if (image?.id && accessToken) {
            mediaMimeType = normalizeMimeType(image.mime_type ?? "image/jpeg");
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              image.id,
              accessToken,
              supabase,
              { clinicId, mediaId: image.id, mimeType: image.mime_type }
            );
            bodyText = mediaUrl ? "" : "[image]";
          } else if (audio?.id && accessToken) {
            mediaMimeType = normalizeMimeType(audio.mime_type ?? "audio/ogg");
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              audio.id,
              accessToken,
              supabase,
              { clinicId, mediaId: audio.id, mimeType: audio.mime_type }
            );
            bodyText = mediaUrl ? "" : "[audio]";
          } else if (video?.id && accessToken) {
            mediaMimeType = normalizeMimeType(video.mime_type ?? "video/mp4");
            mediaUrl = await fetchAndStoreWhatsAppMedia(
              video.id,
              accessToken,
              supabase,
              { clinicId, mediaId: video.id, mimeType: video.mime_type }
            );
            bodyText = mediaUrl ? "" : "[video]";
          } else if (document?.id && accessToken) {
            mediaMimeType = normalizeMimeType(document.mime_type ?? "application/octet-stream");
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
            const updateData: Record<string, unknown> = {
              last_inbound_message_at: now,
              status: "open",
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
                last_inbound_message_at: now,
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
                if (!retry.data?.id) {
                  console.error("[WhatsApp Webhook] Erro ao criar conversa:", insertConv.error);
                  continue;
                }
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
            const msgReferral = (msg as {
              referral?: { source_type?: string; source_url?: string };
            }).referral;
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
              message_type: msgType,
              content: bodyText ?? "",
              media_url: mediaUrl ?? null,
              media_mime_type: mediaMimeType,
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

          logAiEvent(supabase, {
            clinicId,
            conversationId,
            messageId: messageId || undefined,
            stage: "webhook_inbound",
            detail: {
              from,
              msgType,
              bodyPreview: (bodyText ?? "").slice(0, 80),
            },
          });

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

          const routing = await shouldSkipMenuChatbot(supabase, clinicId, conversationId);
          console.info("[WhatsApp Webhook] roteamento pós-mensagem", {
            clinicId,
            conversationId,
            skipMenu: routing.skipMenu,
            reason: routing.reason,
            bodyPreview: (bodyText ?? "").slice(0, 40),
          });

          logAiEvent(supabase, {
            clinicId,
            conversationId,
            messageId: messageId || undefined,
            stage: "routing_decision",
            level: routing.skipMenu ? "info" : "warn",
            detail: {
              skipMenu: routing.skipMenu,
              reason: routing.reason ?? null,
            },
          });

          if (routing.skipMenu) {
            const debounceSec = Number(vaSettingsRow?.message_debounce_seconds) || 5;
            console.info("[VirtualAssistant] mensagem recebida, agendando IA", {
              clinicId,
              conversationId,
              debounceSec,
            });
            await scheduleAiDebounce(supabase, conversationId, clinicId, debounceSec, messageId);
          } else {
            if (messageId) {
              const inactive =
                routing.reason?.includes("inativo") ||
                routing.reason?.includes("enabled=false") ||
                routing.reason?.includes("sem registro");
              await excludeInboundFromAiQueue(supabase, {
                clinicId,
                conversationId,
                messageId,
                reason: routing.reason ?? "Não encaminhado para IA",
                source: inactive ? "assistant_inactive" : "routing",
              });
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
            } else {
              console.info(
                "[WhatsApp Webhook] menu legado sem resposta (routing != chatbot ou mensagem livre)"
              );
              logAiEvent(supabase, {
                clinicId,
                conversationId,
                stage: "legacy_menu_no_reply",
                level: "warn",
                detail: { bodyPreview: (bodyText ?? "").slice(0, 80) },
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Erro:", err);
    throw err;
  }
}
