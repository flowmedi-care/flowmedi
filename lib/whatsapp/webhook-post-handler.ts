import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-signature";
import { processWhatsAppWebhookInbound } from "@/lib/whatsapp/process-webhook-inbound";

/**
 * Valida assinatura, responde 200 à Meta imediatamente e processa payload em background.
 */
export async function handleWhatsAppWebhookPost(request: NextRequest): Promise<NextResponse> {
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

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const entry = body?.entry;
    if (!Array.isArray(entry) || entry.length === 0) {
      return new NextResponse(null, { status: 200 });
    }
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  waitUntil(
    processWhatsAppWebhookInbound(rawBody).catch((err) => {
      console.error("[WhatsApp Webhook] processamento em background falhou:", err);
    })
  );

  return new NextResponse(null, { status: 200 });
}
