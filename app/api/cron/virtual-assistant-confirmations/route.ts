import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runVirtualAssistantConfirmations } from "@/lib/virtual-assistant/confirmations";

/**
 * Cron: envia confirmações proativas de consulta via assistente virtual.
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
  const clinicId = request.nextUrl.searchParams.get("clinic_id") || undefined;

  const result = await runVirtualAssistantConfirmations(supabase, clinicId ?? undefined);
  return NextResponse.json(result);
}
