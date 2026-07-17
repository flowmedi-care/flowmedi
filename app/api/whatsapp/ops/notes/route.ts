import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { setOperatorNotes, loadOperationsSnapshot } from "@/lib/ops";

/** POST { conversationId, notes } — salva notas via mutator */
export async function POST(request: Request) {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
    const body = await request.json();
    const conversationId = body.conversationId as string | undefined;
    const notes = typeof body.notes === "string" ? body.notes : "";

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
    }

    const roleNorm = String(role ?? "").toLowerCase().trim();
    if (roleNorm !== "admin" && roleNorm !== "secretaria") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const result = await setOperatorNotes({
      supabase,
      clinicId,
      conversationId,
      actorUserId: userId,
      notes,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
