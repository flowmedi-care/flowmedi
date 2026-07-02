import { NextRequest, NextResponse } from "next/server";
import { getLastWebhookPayload } from "@/lib/whatsapp-webhook-debug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * GET /api/whatsapp/webhook/debug
 * Diagnóstico interno — protegido por CRON_SECRET (Bearer ou ?secret=).
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const lastPayload = getLastWebhookPayload();
  const supabase = createServiceRoleClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentEvents } = await supabase
    .from("whatsapp_ai_event_log")
    .select("id, clinic_id, stage, level, detail, created_at, conversation_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    message: lastPayload
      ? "Último payload recebido (webhook está sendo chamado pela Meta)"
      : "Nenhum payload recebido ainda. O webhook só é chamado quando alguém envia mensagem DO celular/WhatsApp PARA o número do negócio — NÃO quando você envia pela interface FlowMed.",
    lastPayload: lastPayload?.body ?? null,
    lastReceivedAt: lastPayload?.receivedAt ?? null,
    recentAiEvents: recentEvents ?? [],
    recentAiEventsNote:
      recentEvents?.length
        ? "Últimos eventos do assistente (24h). Para diagnóstico completo, use Configurações → Assistente Virtual → Diagnóstico."
        : "Nenhum evento do assistente nas últimas 24h (rode migration-whatsapp-ai-events.sql se a tabela não existir).",
  });
}
