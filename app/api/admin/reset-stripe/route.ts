import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSystemAdmin } from "@/lib/auth-helpers";

/**
 * Rota para limpar dados Stripe de teste quando migrar para produção
 * POST /api/admin/reset-stripe
 * Body: { clinic_id?: string } - Se não fornecido, limpa todas as clínicas
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSystemAdmin(false);
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const clinicId = body.clinic_id;

    // Buscar plano Starter
    const { data: starterPlan } = await supabase
      .from("plans")
      .select("id")
      .eq("slug", "starter")
      .single();

    if (!starterPlan) {
      return NextResponse.json({ error: "Plano Starter não encontrado" }, { status: 500 });
    }

    // Limpar dados Stripe
    const updateData: Record<string, unknown> = {
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: null,
      plan_id: starterPlan.id,
    };

    let result;
    if (clinicId) {
      // Limpar apenas uma clínica específica
      result = await supabase
        .from("clinics")
        .update(updateData)
        .eq("id", clinicId)
        .select("id, name")
        .single();
    } else {
      // Limpar todas as clínicas com subscription
      result = await supabase
        .from("clinics")
        .update(updateData)
        .not("stripe_subscription_id", "is", null)
        .select("id, name");
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: clinicId
        ? `Dados Stripe limpos para a clínica ${result.data?.name || clinicId}`
        : `Dados Stripe limpos para ${result.data?.length || 0} clínica(s)`,
      clinics: result.data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao limpar dados Stripe" },
      { status: 500 }
    );
  }
}
