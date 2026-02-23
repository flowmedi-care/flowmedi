import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * Troca de plano via Checkout: abre o Stripe Checkout para o novo plano.
 * Quando o pagamento for concluído, o webhook atualiza a clínica e cancela a assinatura antiga.
 */
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
    .select("id, stripe_customer_id, stripe_subscription_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic?.stripe_customer_id || !clinic?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "É necessário ter uma assinatura ativa para trocar de plano." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  let origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin && process.env.VERCEL_URL) origin = `https://${process.env.VERCEL_URL}`;
  if (!origin) origin = "https://flowmedi.com.br";
  if (!origin.startsWith("http")) origin = `https://${origin}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: clinic.stripe_customer_id,
      line_items: [{ price: targetPlan.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/dashboard/plano?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/plano`,
      metadata: {
        clinic_id: clinic.id,
        plan_change: "1",
        previous_subscription_id: clinic.stripe_subscription_id,
      },
      subscription_data: {
        metadata: { clinic_id: clinic.id },
      },
      payment_method_types: ["card"],
      locale: "pt-BR",
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe não retornou URL de checkout." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout-change-plan error:", err);
    const message = err instanceof Error ? err.message : "Erro ao abrir checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
