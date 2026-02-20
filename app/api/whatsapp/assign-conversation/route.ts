import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";

/**
 * POST /api/whatsapp/assign-conversation
 * Encaminha/atribui conversa para outra secretária.
 * Body: { conversationId, secretaryId }
 * Admin ou secretária que está com a conversa pode encaminhar.
 */
export async function POST(request: Request) {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
    const supabase = await createClient();
    const body = await request.json();
    const conversationId = body.conversationId as string | undefined;
    const secretaryId = body.secretaryId as string | undefined;

    if (!conversationId || !secretaryId) {
      return NextResponse.json(
        { error: "conversationId e secretaryId são obrigatórios" },
        { status: 400 }
      );
    }

    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("id, clinic_id, assigned_secretary_id")
      .eq("id", conversationId)
      .single();

    if (!conv || conv.clinic_id !== clinicId) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    const canForward =
      role === "admin" ||
      conv.assigned_secretary_id === userId;

    if (!canForward) {
      return NextResponse.json(
        { error: "Apenas admin ou a secretária responsável pode encaminhar" },
        { status: 403 }
      );
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, role, clinic_id")
      .eq("id", secretaryId)
      .single();

    if (
      !targetProfile ||
      targetProfile.clinic_id !== clinicId ||
      targetProfile.role !== "secretaria"
    ) {
      return NextResponse.json(
        { error: "Secretária inválida ou não pertence à clínica" },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from("whatsapp_conversations")
      .update({
        assigned_secretary_id: secretaryId,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await supabase
      .from("conversation_eligible_secretaries")
      .delete()
      .eq("conversation_id", conversationId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao encaminhar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
