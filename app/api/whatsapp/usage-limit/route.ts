import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import {
  getClinicOpsConfig,
  getCurrentPost24hLimitStatus,
} from "@/lib/whatsapp-ops-controls";

export async function GET() {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();

    const [config, limitStatus] = await Promise.all([
      getClinicOpsConfig(clinicId, supabase),
      getCurrentPost24hLimitStatus(clinicId, supabase),
    ]);

    return NextResponse.json({
      limit: limitStatus.limit,
      used: limitStatus.used,
      remaining: limitStatus.remaining,
      blocked: limitStatus.blocked,
      timezone: config.auto_message_timezone || "America/Sao_Paulo",
      send_window_start: config.auto_message_send_start,
      send_window_end: config.auto_message_send_end,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao consultar limite";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
