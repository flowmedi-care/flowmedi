import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runAutoSendForEvent } from "@/lib/event-send-logic-server";

/**
 * Cron: verifica compliance de confirmação e cria eventos "Consulta ainda não confirmada".
 * Chamado periodicamente (ex: 1x/dia). Cria appointment_not_confirmed para consultas
 * cujo prazo de compliance (scheduled_at - X dias) já passou e ainda estão como agendada.
 * Processa envio automático (email/WhatsApp) conforme config da clínica.
 *
 * Protegido por CRON_SECRET no header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && token !== expectedSecret) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY não configurada" },
        { status: 500 }
      );
    }

    const supabase = createServiceRoleClient();
    const clinicId = request.nextUrl.searchParams.get("clinic_id") || undefined;

    const { data, error } = await supabase.rpc(
      "check_compliance_and_create_not_confirmed_events",
      { p_clinic_id: clinicId || null }
    );

    if (error) {
      console.error("[cron/check-compliance]", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Processar envio automático para cada evento criado
    const eventIds = (data?.event_ids as string[] | null) || [];
    let sentCount = 0;
    for (const eventId of eventIds) {
      const { data: ev } = await supabase
        .from("event_timeline")
        .select("clinic_id, event_code")
        .eq("id", eventId)
        .single();
      if (ev) {
        const { sent } = await runAutoSendForEvent(
          eventId,
          ev.clinic_id,
          ev.event_code,
          supabase
        );
        if (sent) sentCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      created_count: data?.created_count ?? 0,
      sent_count: sentCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/check-compliance]", e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
