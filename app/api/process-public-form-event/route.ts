import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processEventByIdForPublicForm } from "@/lib/message-processor";

/**
 * Chamado após o envio de um formulário público para disparar o envio automático
 * de email (se o evento estiver configurado como automático).
 * Body: { form_instance_id: string }
 * Requer SUPABASE_SERVICE_ROLE_KEY no .env para rodar sem usuário logado.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formInstanceId = body?.form_instance_id;
    if (!formInstanceId || typeof formInstanceId !== "string") {
      return NextResponse.json(
        { error: "form_instance_id é obrigatório" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true, sent: false });
    }

    const supabase = createServiceRoleClient();
    const { data: events, error: fetchError } = await supabase
      .from("event_timeline")
      .select("id, clinic_id, event_code")
      .eq("form_instance_id", formInstanceId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("[process-public-form-event] Supabase fetch events:", fetchError);
      return NextResponse.json(
        { error: "Erro ao buscar evento", debug: fetchError.message },
        { status: 500 }
      );
    }

    if (!events?.length) {
      return NextResponse.json({ ok: true, sent: false });
    }

    const event = events[0];

    // Só enviar automaticamente se: sistema ligado para o evento E envio em modo automático para email
    const { data: eventConfig } = await supabase
      .from("clinic_event_config")
      .select("system_enabled")
      .eq("clinic_id", event.clinic_id)
      .eq("event_code", event.event_code)
      .maybeSingle();

    const systemEnabled = eventConfig?.system_enabled ?? true;

    const { data: emailSetting } = await supabase
      .from("clinic_message_settings")
      .select("enabled, send_mode")
      .eq("clinic_id", event.clinic_id)
      .eq("event_code", event.event_code)
      .eq("channel", "email")
      .maybeSingle();

    const emailAutomatic =
      emailSetting?.enabled === true && emailSetting?.send_mode === "automatic";

    if (!systemEnabled || !emailAutomatic) {
      return NextResponse.json({ ok: true, sent: false });
    }

    const result = await processEventByIdForPublicForm(event.id, supabase);
    if (!result.success) {
      console.error("[process-public-form-event] processEventByIdForPublicForm:", result.error);
      return NextResponse.json(
        { error: result.error || "Erro ao enviar", debug: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[process-public-form-event]", e);
    return NextResponse.json(
      {
        error: "Erro interno",
        debug: message,
        ...(process.env.NODE_ENV === "development" && stack && { stack }),
      },
      { status: 500 }
    );
  }
}
