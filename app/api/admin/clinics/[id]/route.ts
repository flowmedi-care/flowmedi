import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSystemAdmin } from "@/lib/auth-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSystemAdmin(false);
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // Validar que o plano existe (se fornecido)
    if (body.plan_id) {
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id")
        .eq("id", body.plan_id)
        .maybeSingle();

      if (planError || !plan) {
        return NextResponse.json({ error: "Plano não encontrado" }, { status: 400 });
      }
    }

    // Validar subscription_status (se fornecido)
    const validStatuses = ["active", "past_due", "canceled", "unpaid"];
    if (body.subscription_status && !validStatuses.includes(body.subscription_status)) {
      return NextResponse.json(
        { error: "Status de assinatura inválido" },
        { status: 400 }
      );
    }

    // Atualizar clínica
    const updateData: Record<string, unknown> = {
      plan_id: body.plan_id || null,
      subscription_status: body.subscription_status || null,
    };

    // Se estiver removendo o plano Pro ou desativando, limpar IDs do Stripe também
    // (opcional: você pode querer manter para histórico)
    if (!body.plan_id || (body.subscription_status && body.subscription_status !== "active")) {
      // Opcional: limpar stripe_subscription_id se não estiver mais ativo
      // updateData.stripe_subscription_id = null;
    }

    const { data, error } = await supabase
      .from("clinics")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar clínica" },
      { status: 500 }
    );
  }
}
