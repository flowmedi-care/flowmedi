import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { checkRateLimit } from "@/lib/public-site/rate-limit";
import { runAutoSendForEvent } from "@/lib/event-send-logic-server";

export const dynamic = "force-dynamic";

type SubmitBody = {
  template_id?: string;
  submitter_name?: string;
  submitter_email?: string;
  submitter_phone?: string | null;
  submitter_birth_date?: string | null;
  responses?: Record<string, unknown>;
  custom_fields?: Record<string, unknown> | null;
  health_data_notice_accepted?: boolean;
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`public-form:${ip}`, 10, 300_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite de envios atingido. Tente mais tarde." },
      { status: 429 }
    );
  }

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const templateId = body.template_id?.trim();
  const submitterName = body.submitter_name?.trim();
  const submitterEmail = body.submitter_email?.trim();

  if (!templateId) {
    return NextResponse.json({ error: "template_id é obrigatório." }, { status: 400 });
  }
  if (!submitterName) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (!submitterEmail) {
    return NextResponse.json({ error: "E-mail é obrigatório." }, { status: 400 });
  }
  if (!body.health_data_notice_accepted) {
    return NextResponse.json(
      { error: "É necessário aceitar o aviso sobre dados de saúde." },
      { status: 400 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Erro ao enviar formulário." }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { data, error: rpcError } = await supabase.rpc("create_public_form_instance", {
    p_template_id: templateId,
    p_submitter_name: submitterName,
    p_submitter_email: submitterEmail,
    p_submitter_phone: body.submitter_phone ?? null,
    p_submitter_birth_date: body.submitter_birth_date ?? null,
    p_responses: body.responses ?? {},
    p_custom_fields:
      body.custom_fields && Object.keys(body.custom_fields).length > 0
        ? body.custom_fields
        : null,
  });

  if (rpcError) {
    console.error("[public/form/submit] create_public_form_instance:", rpcError);
    return NextResponse.json({ error: "Erro ao enviar formulário." }, { status: 500 });
  }

  const result = data as { success?: boolean; error?: string; instance_id?: string };
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Erro ao enviar formulário." },
      { status: 400 }
    );
  }

  const instanceId = result.instance_id;
  if (instanceId) {
    const { data: events, error: fetchError } = await supabase
      .from("event_timeline")
      .select("id, clinic_id, event_code")
      .eq("form_instance_id", instanceId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("[public/form/submit] fetch event:", fetchError);
    } else if (events?.length) {
      const event = events[0];
      const { error: sendError } = await runAutoSendForEvent(
        event.id,
        event.clinic_id,
        event.event_code,
        supabase
      );
      if (sendError) {
        console.error("[public/form/submit] runAutoSendForEvent:", sendError);
      }
    }
  }

  return NextResponse.json({ success: true });
}
