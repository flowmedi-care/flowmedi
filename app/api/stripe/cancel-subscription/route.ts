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
    return NextResponse.json({ error: "Apenas admin pode cancelar." }, { status: 403 });
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("stripe_subscription_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Nenhuma assinatura ativa para cancelar." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  await stripe.subscriptions.update(clinic.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ success: true });
}
