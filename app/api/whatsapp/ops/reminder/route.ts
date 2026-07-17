import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { setOwner, setPendingDecision, loadOperationsSnapshot } from "@/lib/ops";
import { emitOpsEvent } from "@/lib/ops/event-bridge";

/**
 * POST { conversationId, dueAt?, label? }
 * Agenda lembrete "me chama amanhã" — owner System + pendingDecision.
 */
export async function POST(request: Request) {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
    const body = await request.json();
    const conversationId = body.conversationId as string | undefined;

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
    }

    const roleNorm = String(role ?? "").toLowerCase().trim();
    if (roleNorm !== "admin" && roleNorm !== "secretaria") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const dueAt =
      typeof body.dueAt === "string"
        ? body.dueAt
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const supabase = createServiceRoleClient();

    await setOwner({
      supabase,
      clinicId,
      conversationId,
      actorUserId: userId,
      owner: "system",
      ownerUserId: null,
      reason: "callback_reminder",
    });

    await emitOpsEvent("system_reminder_scheduled", {
      supabase,
      clinicId,
      conversationId,
      reminderDueAt: dueAt,
    });

    // Ensure decision label customizable
    if (typeof body.label === "string" && body.label.trim()) {
      await setPendingDecision({
        supabase,
        clinicId,
        conversationId,
        decision: {
          type: "callback_reminder",
          label: body.label.trim(),
          owner: "system",
          priority: "normal",
          dueAt,
          source: "system",
          status: "pending",
          actions: [{ id: "call_now", label: "Contatar agora", kind: "contact" }],
        },
      });
    }

    const snapshot = await loadOperationsSnapshot(supabase, conversationId, {
      viewerUserId: userId,
      viewerIsAdmin: roleNorm === "admin",
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
