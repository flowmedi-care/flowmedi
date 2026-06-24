import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processConversationAi } from "@/lib/virtual-assistant/process-inbound";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return process.env.NODE_ENV !== "production";
  return token === expectedSecret;
}

/**
 * POST /api/internal/process-whatsapp-ai
 * Processa mensagens pendentes após debounce (chamado pelo webhook).
 * Body: { conversationId: string }
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let conversationId: string | undefined;
  try {
    const body = await request.json();
    conversationId = body?.conversationId;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const maxWaitMs = 30_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("ai_debounce_until")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    const debounceUntil = conv.ai_debounce_until
      ? new Date(conv.ai_debounce_until).getTime()
      : 0;

    if (!debounceUntil || debounceUntil <= Date.now()) {
      break;
    }

    const waitMs = Math.min(debounceUntil - Date.now() + 50, 2000);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  try {
    await processConversationAi(supabase, conversationId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[internal/process-whatsapp-ai]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar" },
      { status: 500 }
    );
  }
}
