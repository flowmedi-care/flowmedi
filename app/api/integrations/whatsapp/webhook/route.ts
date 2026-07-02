import { NextRequest, NextResponse } from "next/server";
import {
  requireMetaWebhookVerifyToken,
} from "@/lib/meta-webhook-signature";
import { handleWhatsAppWebhookPost } from "@/lib/whatsapp/webhook-post-handler";

export const maxDuration = 60;

/**
 * GET /api/integrations/whatsapp/webhook
 * Verificação do webhook pela Meta (hub.mode, hub.verify_token, hub.challenge).
 * URL no app Meta: https://www.flowmed.app/api/integrations/whatsapp/webhook
 * (https://www.flowmedi.com.br/... continua válido no mesmo deploy — sem redirect em /api)
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
 * POST /api/integrations/whatsapp/webhook
 * Recebe notificações da Meta (mensagens recebidas).
 * Responde 200 imediatamente; processamento pesado roda em background via waitUntil.
 */
export async function POST(request: NextRequest) {
  return handleWhatsAppWebhookPost(request);
}
