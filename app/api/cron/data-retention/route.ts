import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron: elimina logs operacionais além do prazo de retenção (LGPD art. 15–16).
 * Protegido por CRON_SECRET.
 *
 * Exemplo crontab (semanal):
 * 0 3 * * 0 curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://flowmed.app/api/cron/data-retention"
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada" },
      { status: 500 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: settings } = await supabase
    .from("compliance_retention_settings")
    .select("ai_event_log_retention_days, message_log_retention_days")
    .eq("id", 1)
    .maybeSingle();

  const aiDays = settings?.ai_event_log_retention_days ?? 730;
  const msgDays = settings?.message_log_retention_days ?? 730;

  const aiCutoff = new Date();
  aiCutoff.setDate(aiCutoff.getDate() - aiDays);

  const msgCutoff = new Date();
  msgCutoff.setDate(msgCutoff.getDate() - msgDays);

  const [aiResult, msgResult] = await Promise.all([
    supabase
      .from("whatsapp_ai_event_log")
      .delete()
      .lt("created_at", aiCutoff.toISOString())
      .select("id"),
    supabase
      .from("message_log")
      .delete()
      .lt("created_at", msgCutoff.toISOString())
      .select("id"),
  ]);

  if (aiResult.error) {
    console.error("[cron/data-retention] ai_event_log", aiResult.error);
    return NextResponse.json({ error: aiResult.error.message }, { status: 500 });
  }
  if (msgResult.error) {
    console.error("[cron/data-retention] message_log", msgResult.error);
    return NextResponse.json({ error: msgResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ai_event_log_deleted: aiResult.data?.length ?? 0,
    message_log_deleted: msgResult.data?.length ?? 0,
    ai_cutoff: aiCutoff.toISOString(),
    message_cutoff: msgCutoff.toISOString(),
  });
}
