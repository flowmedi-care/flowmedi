import { NextResponse } from "next/server";
import { getLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";

/**
 * GET /api/whatsapp/webhook/debug
 * Retorna o último payload recebido pela Meta (para debug).
 * Acesse: https://flowmedi.com.br/api/whatsapp/webhook/debug
 * Se lastPayload for null, o webhook não está sendo chamado.
 */
export async function GET() {
  const lastPayload = getLastWebhookPayload();
  return NextResponse.json({
    ok: true,
    message: lastPayload
      ? "Último payload recebido (webhook está sendo chamado pela Meta)"
      : "Nenhum payload recebido ainda. O webhook só é chamado quando alguém envia mensagem DO celular/WhatsApp PARA o número do negócio — NÃO quando você envia pela interface FlowMedi.",
    lastPayload: lastPayload?.body ?? null,
    lastReceivedAt: lastPayload?.receivedAt ?? null,
  });
}
