import { NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  findClinicConversationIdsToProcess,
  gatherAssistantDiagnostics,
} from "@/lib/virtual-assistant/diagnostics";
import { processConversationAi } from "@/lib/virtual-assistant/process-inbound";

/**
 * POST /api/whatsapp/assistant/process-now
 * Processa fila de IA da clínica (debounce expirado + mensagens pendentes).
 */
export async function POST() {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const supabase = createServiceRoleClient();
    const conversationIds = await findClinicConversationIdsToProcess(supabase, clinicId);

    let processed = 0;
    const errors: { conversationId: string; message: string }[] = [];

    for (const conversationId of conversationIds) {
      try {
        await processConversationAi(supabase, conversationId);
        processed++;
      } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
        errors.push({
          conversationId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const diagnostics = await gatherAssistantDiagnostics(supabase, clinicId);

    return NextResponse.json({
      processed,
      total: conversationIds.length,
      errors,
      ...diagnostics,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao processar fila";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
