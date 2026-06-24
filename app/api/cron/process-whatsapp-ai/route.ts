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

  const { data: debounced } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .lte("ai_debounce_until", now)
    .is("ai_handoff_at", null)
    .neq("ai_enabled", false)
    .limit(50);

  const { data: pendingRows } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .limit(100);

  const ids = new Set<string>();
  for (const c of debounced ?? []) ids.add(c.id);
  for (const row of pendingRows ?? []) {
    if (row.conversation_id) ids.add(row.conversation_id);
  }

  let processed = 0;
  for (const conversationId of ids) {
    try {
      await processConversationAi(supabase, conversationId);
      processed++;
    } catch (e) {
      console.error("[cron/process-whatsapp-ai]", conversationId, e);
    }
  }

  return NextResponse.json({ processed, total: ids.size });
}
