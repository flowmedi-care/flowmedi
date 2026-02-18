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

    for (const entry of body.entry ?? []) {
      const phoneId = entry.id;
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        // Status updates (delivered, read, sent, failed)
        for (const status of value?.statuses ?? []) {
          console.log("[WhatsApp Webhook] status:", {
            phone_number_id: value?.metadata?.phone_number_id ?? phoneId,
            message_id: status.id,
            status: status.status,
            recipient_id: status.recipient_id,
            errors: status.errors,
          });
          // Aqui você pode persistir status (entregue, lido) ou atualizar mensagens no banco
        }

        // Mensagens recebidas
        for (const msg of value?.messages ?? []) {
          console.log("[WhatsApp Webhook] message:", {
            phone_number_id: value?.metadata?.phone_number_id ?? phoneId,
            from: msg.from,
            type: msg.type,
            id: msg.id,
          });
          // Aqui você pode processar respostas do paciente (ex.: respostas a lembretes)
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
