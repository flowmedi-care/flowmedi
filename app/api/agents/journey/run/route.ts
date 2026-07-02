import { NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runJourneyAgentBatch } from "@/lib/operational-agents/journey-agent";

export async function POST(request: Request) {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);

    const supabase = createServiceRoleClient();
    const result = await runJourneyAgentBatch(supabase, clinicId, limit);

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiAuthError) return toApiErrorResponse(e);
    const message = e instanceof Error ? e.message : "Erro ao executar Journey Agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
