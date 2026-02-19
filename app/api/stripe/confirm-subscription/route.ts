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

  const body = await request.json();
  const { paymentIntentId, taxId, taxIdType, paymentMethodId, address } = body;

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Payment Intent ID não fornecido." }, { status: 400 });
  }

  if (!paymentMethodId) {
    return NextResponse.json({ error: "Payment Method ID não fornecido." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  try {
    // Buscar Payment Intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent.customer || typeof paymentIntent.customer !== "string") {
      return NextResponse.json({ error: "Customer não encontrado." }, { status: 400 });
    }

    // Atualizar endereço do customer se fornecido
    if (address) {
      try {
        await stripe.customers.update(paymentIntent.customer, {
          address: {
            line1: `${address.street}, ${address.number}`,
            line2: address.complement || undefined,
            city: address.city,
            state: address.state,
            postal_code: address.zipCode.replace(/\D/g, ""),
            country: "BR",
          },
        });
      } catch (addrErr) {
        console.error("Stripe address update error:", addrErr);
        // Não falhar se não conseguir atualizar endereço
      }
    }

    // Adicionar tax_id se fornecido
    if (taxId && taxIdType) {
      try {
        const stripeTaxIdType = taxIdType === "cpf" ? "br_cpf" : "br_cnpj";
        await stripe.customers.createTaxId(paymentIntent.customer, {
          type: stripeTaxIdType,
          value: taxId,
        });
      } catch (taxErr) {
        console.error("Stripe tax_id create error:", taxErr);
        // Não falhar se não conseguir adicionar tax_id
      }
    }

    // Confirmar Payment Intent com o payment method
    const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    if (confirmedIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: `Pagamento não foi confirmado. Status: ${confirmedIntent.status}` },
        { status: 400 }
      );
    }

    // Buscar o plano Pro
    const { data: proPlan } = await supabase
      .from("plans")
      .select("id, stripe_price_id")
      .eq("slug", "pro")
      .single();

    if (!proPlan?.stripe_price_id) {
      return NextResponse.json(
        { error: "Plano Pro não configurado." },
        { status: 500 }
      );
    }

    // Criar assinatura após pagamento confirmado
    const subscription = await stripe.subscriptions.create({
      customer: paymentIntent.customer,
      items: [{ price: proPlan.stripe_price_id }],
      metadata: { clinic_id: paymentIntent.metadata.clinic_id },
      default_payment_method: paymentMethodId,
    });

    // Atualizar clínica no banco
    const clinicId = paymentIntent.metadata.clinic_id;
    if (clinicId) {
      await supabase
        .from("clinics")
        .update({
          plan_id: proPlan.id,
          stripe_subscription_id: subscription.id,
          subscription_status: "active",
        })
        .eq("id", clinicId);
    }

    return NextResponse.json({ 
      success: true,
      subscriptionId: subscription.id,
    });
  } catch (err) {
    console.error("Stripe confirm subscription error:", err);
    const message = err instanceof Error ? err.message : "Erro ao confirmar assinatura.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
