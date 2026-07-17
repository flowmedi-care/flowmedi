import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { VIRTUAL_ASSISTANT_ASSIGNEE_ID } from "@/lib/whatsapp-ai-state";
import {
  isVirtualAssistantActive,
  scheduleAiDebounce,
} from "@/lib/virtual-assistant/process-inbound";
import {
  assignToHuman,
  claimConversation,
  reactivateAi,
  loadOperationsSnapshot,
} from "@/lib/ops";

/**
 * POST /api/whatsapp/assign-conversation
 * Body: { conversationId, secretaryId, brief?, claim? }
 * secretaryId = VIRTUAL_ASSISTANT_ASSIGNEE_ID → devolve à IA (brief opcional).
 * claim=true → claim atômico para o usuário atual.
 * Assign humano sempre pausa IA via mutators.
 */
export async function POST(request: Request) {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
    const supabase = await createClient();
    const body = await request.json();
    const conversationId = body.conversationId as string | undefined;
    const secretaryId = body.secretaryId as string | undefined;
    const brief = typeof body.brief === "string" ? body.brief : undefined;
    const claim = Boolean(body.claim);

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório" },
        { status: 400 }
      );
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

    // Claim atômico (Assumir atendimento)
    if (claim || secretaryId === userId) {
      const result = await claimConversation({
        supabase: serviceSupabase,
        clinicId,
        conversationId,
        actorUserId: userId,
        claimantUserId: userId,
        reason: "claim",
      });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            conflict: result.conflict,
            currentOwnerLabel: result.currentOwnerLabel,
          },
          { status: result.conflict ? 409 : 400 }
        );
      }
      const snapshot = await loadOperationsSnapshot(serviceSupabase, conversationId, {
        viewerUserId: userId,
        viewerIsAdmin: isAdmin,
      });
      return NextResponse.json({ ok: true, handler: "human", snapshot });
    }

    if (!secretaryId) {
      return NextResponse.json(
        { error: "conversationId e secretaryId são obrigatórios" },
        { status: 400 }
      );
    }

    if (secretaryId === VIRTUAL_ASSISTANT_ASSIGNEE_ID) {
      const result = await reactivateAi({
        supabase: serviceSupabase,
        clinicId,
        conversationId,
        actorUserId: userId,
        brief: brief ?? null,
        reason: "assign_forward_ai",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const { active, settings } = await isVirtualAssistantActive(serviceSupabase, clinicId);
      if (active) {
        const debounceSec = Number(settings?.message_debounce_seconds) || 5;
        await scheduleAiDebounce(serviceSupabase, conversationId, clinicId, debounceSec);
      }

      const snapshot = await loadOperationsSnapshot(serviceSupabase, conversationId, {
        viewerUserId: userId,
        viewerIsAdmin: isAdmin,
      });
      return NextResponse.json({ ok: true, handler: "ai", snapshot });
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

    const result = await assignToHuman({
      supabase: serviceSupabase,
      clinicId,
      conversationId,
      actorUserId: userId,
      secretaryId,
      reason: "assign_transfer",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const snapshot = await loadOperationsSnapshot(serviceSupabase, conversationId, {
      viewerUserId: userId,
      viewerIsAdmin: isAdmin,
    });
    return NextResponse.json({ ok: true, handler: "human", snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao encaminhar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
