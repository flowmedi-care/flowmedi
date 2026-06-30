import { NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { clearAssistantQueue } from "@/lib/virtual-assistant/clear-queue";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";

/**
 * POST /api/whatsapp/assistant/clear-queue
 * Descarta fila pendente da IA sem enviar respostas (reinício limpo).
 */
export async function POST() {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const supabase = createServiceRoleClient();

    const result = await clearAssistantQueue(supabase, clinicId);

    logAiEvent(supabase, {
      clinicId,
      stage: "queue_cleared",
      level: "warn",
      detail: {
        manual: true,
        ...result,
      },
    });

    const diagnostics = await gatherAssistantDiagnostics(supabase, clinicId);

    return NextResponse.json({
      ok: true,
      ...result,
      ...diagnostics,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao zerar fila";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
