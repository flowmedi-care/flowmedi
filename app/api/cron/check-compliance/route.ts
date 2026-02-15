import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runAutoSendForEvent } from "@/lib/event-send-logic-server";

/**
 * Cron: verifica compliance de confirmação e de formulário vinculado.
 * 1) Cria eventos "Consulta ainda não confirmada" (appointment_not_confirmed) quando o prazo passou.
 * 2) Cria eventos "Lembrete para Preencher Formulário" (form_reminder) quando o prazo do formulário passou.
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

    // 1) Compliance de confirmação: consulta ainda não confirmada
    const { data: confirmData, error: confirmError } = await supabase.rpc(
      "check_compliance_and_create_not_confirmed_events",
      { p_clinic_id: clinicId || null }
    );

    if (confirmError) {
      console.error("[cron/check-compliance] confirmation", confirmError);
      return NextResponse.json(
        { error: confirmError.message },
        { status: 500 }
      );
    }

    const confirmEventIds = (confirmData?.event_ids as string[] | null) || [];
    let sentCount = 0;
    for (const eventId of confirmEventIds) {
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

    // 2) Compliance de formulário vinculado: lembrete para preencher formulário
    const { data: formData, error: formError } = await supabase.rpc(
      "check_compliance_and_create_form_reminder_events",
      { p_clinic_id: clinicId || null }
    );

    if (formError) {
      console.error("[cron/check-compliance] form_reminder", formError);
      return NextResponse.json(
        { error: formError.message },
        { status: 500 }
      );
    }

    const formEventIds = (formData?.event_ids as string[] | null) || [];
    for (const eventId of formEventIds) {
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
      confirmation_created: confirmData?.created_count ?? 0,
      form_reminder_created: formData?.created_count ?? 0,
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
