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
  
  // Se tem customer_id, verificar se existe na Stripe e garantir país BR
  if (customerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(customerId);
      // Se o customer não tem país ou não é BR, atualizar para BR
      if (!existingCustomer.deleted && (!existingCustomer.address?.country || existingCustomer.address.country !== "BR")) {
        await stripe.customers.update(customerId, {
          address: {
            country: "BR", // Garantir país Brasil para tax_id_collection funcionar
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "";
      // Se o customer não existe (modo teste vs produção), limpar e criar novo
      if (errorMessage.includes("No such customer")) {
        console.log(`Customer ${customerId} não existe na Stripe (modo teste vs produção). Criando novo.`);
        customerId = null;
        await supabase
          .from("clinics")
          .update({ stripe_customer_id: null })
          .eq("id", clinic.id);
      } else {
        throw err;
      }
    }
  }
  
  // Criar customer se não existe
  if (!customerId) {
    try {
      // Criar customer com país Brasil
      const customerData: {
        email?: string;
        name: string;
        metadata: { clinic_id: string };
        address: { country: string };
      } = {
        email: user.email ?? undefined,
        name: clinic.name,
        metadata: { clinic_id: clinic.id },
        address: {
          country: "BR", // Brasil
        },
      };

      const customer = await stripe.customers.create(customerData);
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

  // Garantir que a URL sempre tenha o esquema https://
  let origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) {
    if (process.env.VERCEL_URL) {
      origin = `https://${process.env.VERCEL_URL}`;
    } else {
      origin = "https://flowmedi.com.br"; // Fallback para produção
    }
  }
  
  // Garantir que a URL comece com https:// ou http://
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    origin = `https://${origin}`;
  }
  
  const returnUrl = `${origin}/dashboard/plano?session_id={CHECKOUT_SESSION_ID}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      customer: customerId,
      line_items: [{ price: proPlan.stripe_price_id, quantity: 1 }],
      return_url: returnUrl,
      metadata: { clinic_id: clinic.id },
      subscription_data: {
        metadata: { clinic_id: clinic.id },
      },
      // Habilitar cálculo automático de impostos (necessário para tax_id aparecer)
      automatic_tax: {
        enabled: true,
      },
      // Coletar CPF/CNPJ durante o checkout (obrigatório para países suportados como Brasil)
      tax_id_collection: {
        enabled: true,
        required: "if_supported", // Obrigatório se o país suportar (Brasil suporta)
      },
      // Coletar endereço completo (obrigatório para Stripe detectar país BR e calcular impostos)
      billing_address_collection: "required",
      // Permitir atualizar informações do customer durante o checkout
      customer_update: {
        name: "auto",
        address: "auto",
      },
      payment_method_types: ["card"],
      // Configurar locale para português brasileiro
      locale: "pt-BR",
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    const message = err instanceof Error ? err.message : "Erro ao criar sessão na Stripe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
