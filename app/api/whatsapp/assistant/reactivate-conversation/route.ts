import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

/**
 * POST /api/whatsapp/assistant/reactivate-conversation
 * Body: { conversationId?: string, phone?: string }
 * Limpa handoff / pausa da IA para a conversa voltar a ser atendida pelo assistente.
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicAdmin();
    const body = (await request.json()) as { conversationId?: string; phone?: string };
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

    const { data: conv, error: fetchErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, clinic_id, phone_number, ai_handoff_at, ai_enabled, ai_user_opt_out")
      .eq("id", conversationId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (fetchErr || !conv) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    const { error: updateErr } = await supabase
      .from("whatsapp_conversations")
      .update({
        ai_handoff_at: null,
        ai_enabled: true,
        ai_user_opt_out: false,
      })
      .eq("id", conversationId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    logAiEvent(supabase, {
      clinicId,
      conversationId,
      stage: "ai_reactivated",
      detail: {
        manual: true,
        hadHandoff: Boolean(conv.ai_handoff_at),
        hadAiDisabled: conv.ai_enabled === false,
        hadUserOptOut: Boolean(conv.ai_user_opt_out),
        phone: conv.phone_number,
      },
    });

    const diagnostics = await gatherAssistantDiagnostics(supabase, clinicId);
    return NextResponse.json({ ok: true, conversationId, ...diagnostics });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao reativar IA";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
