import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processEventByIdForPublicForm } from "@/lib/message-processor";

/**
 * Chamado após o envio de um formulário público para disparar o envio automático
 * de email (se o evento estiver configurado como automático).
 * Body: { form_instance_id: string }
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

    const supabase = await createClient();
    const { data: events } = await supabase
      .from("event_timeline")
      .select("id")
      .eq("form_instance_id", formInstanceId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!events?.length) {
      return NextResponse.json({ ok: true, sent: false });
    }

    const result = await processEventByIdForPublicForm(events[0].id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao enviar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (e) {
    console.error("process-public-form-event:", e);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  }
}
