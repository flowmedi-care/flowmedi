import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runVirtualAssistantConfirmations } from "@/lib/virtual-assistant/confirmations";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron: envia confirmações proativas de consulta via assistente virtual.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const clinicId = request.nextUrl.searchParams.get("clinic_id") || undefined;

  const result = await runVirtualAssistantConfirmations(supabase, clinicId ?? undefined);
  return NextResponse.json(result);
}
