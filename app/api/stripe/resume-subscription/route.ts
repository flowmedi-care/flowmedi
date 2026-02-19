import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
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
    return NextResponse.json({ error: "Apenas admin pode acessar." }, { status: 403 });
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("stripe_subscription_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Nenhuma assinatura ativa para renovar." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  try {
    await stripe.subscriptions.update(clinic.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erro ao renovar assinatura.";
    
    // Se a subscription não existe (modo teste vs produção), limpar do banco
    if (errorMessage.includes("No such subscription")) {
      const { data: starterPlan } = await supabase
        .from("plans")
        .select("id")
        .eq("slug", "starter")
        .single();
      
      await supabase
        .from("clinics")
        .update({
          stripe_subscription_id: null,
          subscription_status: null,
          plan_id: starterPlan?.id ?? null,
        })
        .eq("id", profile.clinic_id);
      
      return NextResponse.json(
        { error: "Assinatura não encontrada na Stripe (pode ter sido criada em modo de teste). Dados limpos do banco." },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
