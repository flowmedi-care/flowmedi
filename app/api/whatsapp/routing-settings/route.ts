import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/routing-settings
 * Retorna configurações de roteamento (admin).
 */
export async function GET() {
  try {
    const { clinicId } = await requireClinicAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("clinic_whatsapp_routing_settings")
      .select("routing_strategy, general_secretary_id")
      .eq("clinic_id", clinicId)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      routing_strategy: (data as { routing_strategy?: string })?.routing_strategy ?? "first_responder",
      general_secretary_id: (data as { general_secretary_id?: string | null })?.general_secretary_id ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

/**
 * POST /api/whatsapp/routing-settings
 * Atualiza configurações de roteamento (admin).
 * Body: { routing_strategy, general_secretary_id? }
 */
export async function POST(request: Request) {
  try {
    const { clinicId } = await requireClinicAdmin();
    const supabase = await createClient();
    const body = await request.json();
    const routing_strategy = body.routing_strategy as string | undefined;
    const general_secretary_id = body.general_secretary_id as string | undefined;

    if (!routing_strategy || !["general_secretary", "first_responder", "chatbot", "round_robin"].includes(routing_strategy)) {
      return NextResponse.json(
        { error: "routing_strategy deve ser general_secretary, first_responder ou chatbot" },
        { status: 400 }
      );
    }

    if (routing_strategy === "general_secretary" && !general_secretary_id) {
      return NextResponse.json(
        { error: "Selecione a secretária geral quando usar essa estratégia" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("clinic_whatsapp_routing_settings")
      .select("id")
      .eq("clinic_id", clinicId)
      .single();

    const payload = {
      routing_strategy,
      general_secretary_id: routing_strategy === "general_secretary" ? general_secretary_id : null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("clinic_whatsapp_routing_settings")
        .update(payload)
        .eq("id", existing.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await supabase
        .from("clinic_whatsapp_routing_settings")
        .insert({ clinic_id: clinicId, ...payload });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao salvar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
