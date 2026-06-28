import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processConversationAi } from "@/lib/virtual-assistant/process-inbound";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron fallback: processa conversas com debounce expirado ou mensagens pendentes.
 * Protegido por CRON_SECRET — chamar pela VPS, não pelo Vercel Cron.
 *
 * GET /api/cron/process-whatsapp-ai?secret=...
 * ou Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: debounced } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .lte("ai_debounce_until", now)
    .is("ai_handoff_at", null)
    .eq("ai_user_opt_out", false)
    .neq("ai_enabled", false)
    .limit(50);

  const { data: pendingRows } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .limit(100);

  const { data: convsWithJobs } = await supabase
    .from("whatsapp_conversations")
    .select("id, ai_state")
    .is("ai_handoff_at", null)
    .eq("ai_user_opt_out", false)
    .neq("ai_enabled", false)
    .limit(100);

  const ids = new Set<string>();
  for (const c of debounced ?? []) ids.add(c.id);
  for (const row of pendingRows ?? []) {
    if (row.conversation_id) ids.add(row.conversation_id);
  }
  for (const c of convsWithJobs ?? []) {
    const jobs = (c.ai_state as { pending_transcription_jobs?: unknown[] } | null)
      ?.pending_transcription_jobs;
    if (Array.isArray(jobs) && jobs.length > 0) ids.add(c.id);
  }

  let processed = 0;
  for (const conversationId of ids) {
    try {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("clinic_id")
        .eq("id", conversationId)
        .maybeSingle();
      await processConversationAi(supabase, conversationId);
      processed++;
      if (conv?.clinic_id) {
        logAiEvent(supabase, {
          clinicId: conv.clinic_id,
          conversationId,
          stage: "cron_conversation_processed",
          detail: { source: "cron" },
        });
      }
    } catch (e) {
      console.error("[cron/process-whatsapp-ai]", conversationId, e);
    }
  }

  return NextResponse.json({ processed, total: ids.size });
}
