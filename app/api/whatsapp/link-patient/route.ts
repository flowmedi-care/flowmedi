import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";

/**
 * POST /api/whatsapp/link-patient
 * Vincula paciente à conversa WhatsApp e, se houver secretária atribuída, associa em patient_secretary.
 * Body: { conversationId, patientId }
 */
export async function POST(request: Request) {
  try {
    const { clinicId, role } = await requireClinicMemberWithRole();
    const body = await request.json();
    const conversationId = body.conversationId as string | undefined;
    const patientId = body.patientId as string | undefined;

    if (!conversationId || !patientId) {
      return NextResponse.json(
        { error: "conversationId e patientId são obrigatórios" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const roleNorm = String(role ?? "").toLowerCase().trim();
    const isAdmin = roleNorm === "admin";
    const isSecretary = roleNorm === "secretaria";
    if (!isAdmin && !isSecretary) {
      return NextResponse.json(
        { error: "Apenas admin ou secretária podem vincular paciente" },
        { status: 403 }
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

    const { data: patient } = await supabase
      .from("patients")
      .select("id, clinic_id")
      .eq("id", patientId)
      .single();

    if (!patient || patient.clinic_id !== clinicId) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    const serviceSupabase = createServiceRoleClient();

    // 1. Atualizar patient_id na conversa
    await serviceSupabase
      .from("whatsapp_conversations")
      .update({ patient_id: patientId })
      .eq("id", conversationId);

    // 2. Se há secretária atribuída, upsert patient_secretary
    const secretaryId = conv.assigned_secretary_id ? String(conv.assigned_secretary_id) : null;
    if (secretaryId) {
      await serviceSupabase
        .from("patient_secretary")
        .upsert(
          {
            clinic_id: clinicId,
            patient_id: patientId,
            secretary_id: secretaryId,
          },
          { onConflict: "clinic_id,patient_id,secretary_id" }
        );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao vincular paciente";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
