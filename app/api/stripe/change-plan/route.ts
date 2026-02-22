import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

function getOrigin(): string {
  let origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin && process.env.VERCEL_URL) {
    origin = `https://${process.env.VERCEL_URL}`;
  }
  if (!origin) origin = "https://flowmedi.com.br";
  if (!origin.startsWith("http")) origin = `https://${origin}`;
  return origin;
}

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
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;
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
    .select("stripe_subscription_id, stripe_customer_id")
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
    const sub = await stripe.subscriptions.retrieve(clinic.stripe_subscription_id, {
      expand: ["default_payment_method"],
    });
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) {
      return NextResponse.json(
        { error: "Assinatura inválida (sem itens)." },
        { status: 400 }
      );
    }

    let hasPaymentMethod =
      (sub as Stripe.Subscription & { default_payment_method?: Stripe.PaymentMethod | string | null })
        .default_payment_method != null ||
      (typeof sub.default_payment_method === "string" && sub.default_payment_method.length > 0);

    if (sessionId && !hasPaymentMethod) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["setup_intent"],
      });
      if (checkoutSession.mode === "setup" && checkoutSession.status === "complete") {
        const setupIntent = checkoutSession.setup_intent;
        const pmId =
          typeof setupIntent === "object" && setupIntent?.payment_method
            ? typeof setupIntent.payment_method === "string"
              ? setupIntent.payment_method
              : setupIntent.payment_method?.id
            : null;
        if (pmId) {
          const customerId = (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ?? clinic.stripe_customer_id;
          if (customerId) {
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: pmId },
            });
            hasPaymentMethod = true;
          }
        }
      }
    }

    if (!hasPaymentMethod) {
      const customerId = (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ?? clinic.stripe_customer_id;
      if (!customerId) {
        return NextResponse.json(
          { error: "Cliente Stripe não encontrado. Entre em contato com o suporte." },
          { status: 400 }
        );
      }

      const origin = getOrigin();
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        customer: customerId,
        currency: "brl",
        payment_method_types: ["card"],
        success_url: `${origin}/dashboard/plano?session_id={CHECKOUT_SESSION_ID}&setup_complete=1&plan=${encodeURIComponent(planSlug)}`,
        cancel_url: `${origin}/dashboard/plano`,
        metadata: { clinic_id: profile.clinic_id, target_plan: planSlug },
      });

      return NextResponse.json({ setup_required: true, url: session.url });
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
