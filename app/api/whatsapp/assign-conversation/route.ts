import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";

/**
 * POST /api/whatsapp/assign-conversation
 * Encaminha/atribui conversa para outra secretária.
 * Body: { conversationId, secretaryId }
 * Admin ou qualquer secretária da clínica pode encaminhar (ex.: corrigir encaminhamento errado).
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
      .select("id, clinic_id, assigned_secretary_id, patient_id")
      .eq("id", conversationId)
      .single();

    if (!conv || conv.clinic_id !== clinicId) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    // Admin ou qualquer secretária da clínica pode encaminhar (corrigir encaminhamento errado etc.)
    const roleNorm = String(role ?? "").toLowerCase().trim();
    const isAdmin = roleNorm === "admin";
    const isSecretary = roleNorm === "secretaria";
    if (!isAdmin && !isSecretary) {
      return NextResponse.json(
        { error: "Apenas admin ou secretária podem encaminhar" },
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

    const serviceSupabase = createServiceRoleClient();
    const { error: updateErr } = await serviceSupabase
      .from("whatsapp_conversations")
      .update({
        assigned_secretary_id: secretaryId,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await serviceSupabase
      .from("conversation_eligible_secretaries")
      .delete()
      .eq("conversation_id", conversationId);

    // Se a conversa tem paciente vinculado, associar em patient_secretary
    if (conv?.patient_id) {
      await serviceSupabase
        .from("patient_secretary")
        .upsert(
          {
            clinic_id: conv.clinic_id,
            patient_id: conv.patient_id,
            secretary_id: secretaryId,
          },
          { onConflict: "clinic_id,patient_id" }
        );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao encaminhar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
