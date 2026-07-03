import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { fetchConversationPipelineState } from "@/lib/virtual-assistant/conversation-pipeline-state";

/**
 * GET /api/whatsapp/assistant/conversation-pipeline?conversationId=...
 * Estado do pipeline CRM para uma conversa WhatsApp (etapa atual + trilha).
 */
export async function GET(request: Request) {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
    }

    const supabase = await createClient();
    const state = await fetchConversationPipelineState(supabase, clinicId, conversationId);

    if (!state) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    return NextResponse.json(state);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao carregar pipeline da conversa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
