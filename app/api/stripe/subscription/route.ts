import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function GET() {
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
    return NextResponse.json({
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      status: null,
    });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(clinic.stripe_subscription_id);
    const subscription = sub as Stripe.Subscription;
    return NextResponse.json({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end ?? null,
      status: subscription.status ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar assinatura.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
