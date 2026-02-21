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

  // Aceitar plan slug no body (ex: essencial, profissional, estrategico)
  let planSlug = "pro";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.plan && typeof body.plan === "string") {
      planSlug = body.plan.trim().toLowerCase();
    }
  } catch {
    // Body vazio, usar "pro" como fallback
  }

  const { data: targetPlan } = await supabase
    .from("plans")
    .select("id, stripe_price_id")
    .eq("slug", planSlug)
    .single();

  if (!targetPlan?.stripe_price_id) {
    return NextResponse.json(
      { error: `Plano "${planSlug}" não configurado (stripe_price_id). Configure no admin ou use outro plano.` },
      { status: 500 }
    );
  }

  // Buscar o preço para obter o valor
  try {
    const price = await stripe.prices.retrieve(targetPlan.stripe_price_id);
    const amount = price.unit_amount ?? 0;

    let customerId = clinic.stripe_customer_id;
    
    // Se tem customer_id, verificar se existe na Stripe e garantir país BR
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId);
        if (!existingCustomer.deleted && (!existingCustomer.address?.country || existingCustomer.address.country !== "BR")) {
          await stripe.customers.update(customerId, {
            address: { country: "BR" },
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "";
        if (errorMessage.includes("No such customer")) {
          customerId = null;
          await supabase
            .from("clinics")
            .update({ stripe_customer_id: null })
            .eq("id", clinic.id);
        }
      }
    }
    
    // Criar customer se não existe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: clinic.name,
        metadata: { clinic_id: clinic.id },
        address: { country: "BR" },
      });
      customerId = customer.id;
      await supabase
        .from("clinics")
        .update({ stripe_customer_id: customerId })
        .eq("id", clinic.id);
    }

    // Criar Payment Intent sem confirmar (será confirmado após CPF/CNPJ)
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "brl",
      customer: customerId,
      setup_future_usage: "off_session", // Para assinatura recorrente
      metadata: { clinic_id: clinic.id, plan_slug: planSlug },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never", // Não permitir métodos que redirecionam (PIX, boleto, etc.)
      },
    });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe payment intent error:", err);
    const message = err instanceof Error ? err.message : "Erro ao criar intenção de pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
