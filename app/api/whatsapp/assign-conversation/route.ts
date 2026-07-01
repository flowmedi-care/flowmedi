import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { VIRTUAL_ASSISTANT_ASSIGNEE_ID } from "@/lib/whatsapp-ai-state";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import {
  isVirtualAssistantActive,
  scheduleAiDebounce,
} from "@/lib/virtual-assistant/process-inbound";

/**
 * POST /api/whatsapp/assign-conversation
 * Encaminha/atribui conversa para outra secretária ou de volta ao assistente virtual.
 * Body: { conversationId, secretaryId }
 * secretaryId = VIRTUAL_ASSISTANT_ASSIGNEE_ID encaminha para a IA.
 * Admin ou qualquer secretária da clínica pode encaminhar (ex.: corrigir encaminhamento errado).
 */
export async function POST(request: Request) {
  try {
    const { clinicId, role } = await requireClinicMemberWithRole();
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
      .select(
        "id, clinic_id, assigned_secretary_id, patient_id, ai_handoff_at, ai_enabled, ai_user_opt_out"
      )
      .eq("id", conversationId)
      .single();

    if (!conv || conv.clinic_id !== clinicId) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    const roleNorm = String(role ?? "").toLowerCase().trim();
    const isAdmin = roleNorm === "admin";
    const isSecretary = roleNorm === "secretaria";
    if (!isAdmin && !isSecretary) {
      return NextResponse.json(
        { error: "Apenas admin ou secretária podem encaminhar" },
        { status: 403 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    if (secretaryId === VIRTUAL_ASSISTANT_ASSIGNEE_ID) {
      if (conv.ai_user_opt_out) {
        return NextResponse.json(
          {
            error:
              "O paciente desativou respostas automáticas. Peça para enviar ATIVAR no WhatsApp.",
          },
          { status: 400 }
        );
      }

      const { error: updateErr } = await serviceSupabase
        .from("whatsapp_conversations")
        .update({
          ai_handoff_at: null,
          ai_enabled: true,
          assigned_secretary_id: null,
          assigned_at: null,
        })
        .eq("id", conversationId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      await serviceSupabase
        .from("conversation_eligible_secretaries")
        .delete()
        .eq("conversation_id", conversationId);

      logAiEvent(serviceSupabase, {
        clinicId,
        conversationId,
        stage: "ai_reactivated",
        detail: {
          manual: true,
          via: "assign_forward",
          hadHandoff: Boolean(conv.ai_handoff_at),
          hadAiDisabled: conv.ai_enabled === false,
        },
      });

      const { active, settings } = await isVirtualAssistantActive(serviceSupabase, clinicId);
      if (active) {
        const debounceSec = Number(settings?.message_debounce_seconds) || 5;
        await scheduleAiDebounce(serviceSupabase, conversationId, clinicId, debounceSec);
      }

      return NextResponse.json({ ok: true, handler: "ai" });
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

    if (conv?.patient_id) {
      await serviceSupabase
        .from("patient_secretary")
        .upsert(
          {
            clinic_id: conv.clinic_id,
            patient_id: conv.patient_id,
            secretary_id: secretaryId,
          },
          { onConflict: "clinic_id,patient_id,secretary_id" }
        );
    }

    return NextResponse.json({ ok: true, handler: "human" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao encaminhar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
