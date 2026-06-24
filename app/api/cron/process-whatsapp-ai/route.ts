import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processConversationAi } from "@/lib/virtual-assistant/process-inbound";

/**
 * Cron fallback: processa conversas com debounce expirado.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && token !== expectedSecret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: conversations } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .lte("ai_debounce_until", now)
    .is("ai_handoff_at", null)
    .neq("ai_enabled", false)
    .limit(50);

  let processed = 0;
  for (const conv of conversations ?? []) {
    try {
      await processConversationAi(supabase, conv.id);
      processed++;
    } catch (e) {
      console.error("[cron/process-whatsapp-ai]", conv.id, e);
    }
  }

  return NextResponse.json({ processed, total: conversations?.length ?? 0 });
}
