import { NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";
import { runQueueAgent } from "@/lib/operational-agents/queue-agent";

/**
 * POST /api/whatsapp/assistant/process-now
 * Processa fila de IA da clínica (debounce expirado + mensagens pendentes).
 */
export async function POST() {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const supabase = createServiceRoleClient();

    const queueResult = await runQueueAgent(supabase, clinicId);
    const diagnostics = await gatherAssistantDiagnostics(supabase, clinicId);

    return NextResponse.json({
      processed: queueResult.processed,
      total: queueResult.total,
      errors: queueResult.errors,
      batches: queueResult.batches,
      ...diagnostics,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao processar fila";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
