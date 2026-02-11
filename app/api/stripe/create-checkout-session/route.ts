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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas admin pode assinar." }, { status: 403 });
  }
  if (!profile.clinic_id) {
    return NextResponse.json(
      { error: "Crie sua clínica primeiro. Você será redirecionado para completar o cadastro." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe não configurado." },
      { status: 500 }
    );
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, stripe_customer_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic) {
    return NextResponse.json(
      { error: "Clínica não encontrada. Complete o cadastro em Configurações ou crie uma nova clínica." },
      { status: 400 }
    );
  }

  const { data: proPlan } = await supabase
    .from("plans")
    .select("id, stripe_price_id")
    .eq("slug", "pro")
    .single();

  if (!proPlan?.stripe_price_id) {
    return NextResponse.json(
      { error: "Plano Pro não configurado (stripe_price_id)." },
      { status: 500 }
    );
  }

  let customerId = clinic.stripe_customer_id;
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: clinic.name,
        metadata: { clinic_id: clinic.id },
      });
      customerId = customer.id;
      await supabase
        .from("clinics")
        .update({ stripe_customer_id: customerId })
        .eq("id", clinic.id);
    } catch (err) {
      console.error("Stripe customer create error:", err);
      const msg = err instanceof Error ? err.message : "Erro ao criar cliente na Stripe.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const successUrl = `${origin}/dashboard/plano?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/dashboard/plano`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: proPlan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { clinic_id: clinic.id },
      subscription_data: {
        metadata: { clinic_id: clinic.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    const message = err instanceof Error ? err.message : "Erro ao criar sessão na Stripe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
