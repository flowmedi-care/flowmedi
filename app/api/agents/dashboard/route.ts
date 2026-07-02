import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { gatherAgentDashboard } from "@/lib/operational-agents/dashboard";

export async function GET() {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const supabase = await createClient();
    const data = await gatherAgentDashboard(supabase, clinicId);
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ApiAuthError) return toApiErrorResponse(e);
    const message = e instanceof Error ? e.message : "Erro ao carregar dashboard de agentes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
