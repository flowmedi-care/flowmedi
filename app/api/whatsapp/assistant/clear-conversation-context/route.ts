import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { clearConversationContext } from "@/lib/virtual-assistant/clear-conversation-context";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

/**
 * POST /api/whatsapp/assistant/clear-conversation-context
 * Body: { conversationId?: string, phone?: string, reactivate?: boolean }
 * Limpa ai_state e checkpoint da conversa. Histórico de mensagens permanece.
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const body = (await request.json()) as {
      conversationId?: string;
      phone?: string;
      reactivate?: boolean;
    };
    const supabase = createServiceRoleClient();

    let conversationId = body.conversationId?.trim();
    if (!conversationId && body.phone) {
      const phone = normalizeWhatsAppPhone(String(body.phone).replace(/\D/g, ""));
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("phone_number", phone)
        .maybeSingle();
      conversationId = conv?.id;
    }

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId ou phone obrigatório" }, { status: 400 });
    }

    const result = await clearConversationContext(supabase, clinicId, conversationId, {
      reactivate: body.reactivate !== false,
    });

    const diagnostics = await gatherAssistantDiagnostics(supabase, clinicId);
    return NextResponse.json({ ok: true, ...result, ...diagnostics });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao limpar contexto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
