import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Cron: fecha conversas WhatsApp com janela de 24h expirada.
 * - Considera apenas conversas status=open
 * - Não altera conversas status=completed
 * Proteção: Authorization Bearer CRON_SECRET (ou ?secret=)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && token !== expectedSecret) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const clinicId = request.nextUrl.searchParams.get("clinic_id") || null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let selectQuery = supabase
      .from("whatsapp_conversations")
      .select("id, clinic_id")
      .eq("status", "open")
      .not("last_inbound_message_at", "is", null)
      .lt("last_inbound_message_at", twentyFourHoursAgo);

    if (clinicId) {
      selectQuery = selectQuery.eq("clinic_id", clinicId);
    }

    const { data: expired, error: selectError } = await selectQuery;
    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({
        ok: true,
        closed: 0,
        clinics_affected: 0,
        message: "Nenhuma conversa expirada para fechar.",
      });
    }

    let updateQuery = supabase
      .from("whatsapp_conversations")
      .update({ status: "closed" })
      .eq("status", "open")
      .not("last_inbound_message_at", "is", null)
      .lt("last_inbound_message_at", twentyFourHoursAgo);

    if (clinicId) {
      updateQuery = updateQuery.eq("clinic_id", clinicId);
    }

    const { error: updateError } = await updateQuery;
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const clinicsAffected = new Set(expired.map((c) => c.clinic_id)).size;
    return NextResponse.json({
      ok: true,
      closed: expired.length,
      clinics_affected: clinicsAffected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/close-whatsapp-expired]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

