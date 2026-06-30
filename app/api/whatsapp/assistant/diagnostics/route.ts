import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";

/**
 * GET /api/whatsapp/assistant/diagnostics
 * Health check + timeline de eventos do assistente virtual.
 */
export async function GET() {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const supabase = await createClient();
    const data = await gatherAssistantDiagnostics(supabase, clinicId);
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao carregar diagnóstico";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
