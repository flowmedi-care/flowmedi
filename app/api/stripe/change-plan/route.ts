import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.clinic_id) {
    return NextResponse.json({ error: "Apenas admin pode alterar o plano." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const planSlug = typeof body.plan === "string" ? body.plan.trim().toLowerCase() : null;
  if (!planSlug) {
    return NextResponse.json({ error: "Plano não informado." }, { status: 400 });
  }

  const { data: targetPlan } = await supabase
    .from("plans")
    .select("id, stripe_price_id")
    .eq("slug", planSlug)
    .eq("is_active", true)
    .single();

  if (!targetPlan?.stripe_price_id) {
    return NextResponse.json(
      { error: `Plano "${planSlug}" não encontrado ou não configurado para pagamento.` },
      { status: 400 }
    );
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("stripe_subscription_id, plan_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Nenhuma assinatura ativa para alterar." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(clinic.stripe_subscription_id);
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) {
      return NextResponse.json(
        { error: "Assinatura inválida (sem itens)." },
        { status: 400 }
      );
    }

    await stripe.subscriptions.update(clinic.stripe_subscription_id, {
      items: [{ id: itemId, price: targetPlan.stripe_price_id }],
      proration_behavior: "create_prorations",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Stripe change plan error:", err);
    const message = err instanceof Error ? err.message : "Erro ao alterar plano.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
