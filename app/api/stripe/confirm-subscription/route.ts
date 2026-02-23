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

    // Verificar status do Payment Intent antes de processar
    if (paymentIntent.status === "succeeded") {
      // Payment Intent já foi confirmado e pago
      // Verificar se já existe assinatura para evitar duplicação
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: paymentIntent.customer,
        status: "active",
        limit: 1,
      });

      if (existingSubscriptions.data.length > 0) {
        // Já existe assinatura, apenas atualizar dados
        const existingSubscription = existingSubscriptions.data[0];
        const clinicId = paymentIntent.metadata.clinic_id;
        
        if (clinicId) {
          const planSlugExisting = (paymentIntent.metadata?.plan_slug as string) || "pro";
          const { data: planForExisting } = await supabase
            .from("plans")
            .select("id")
            .eq("slug", planSlugExisting)
            .single();

          const updateData: any = {
            plan_id: planForExisting?.id,
            stripe_subscription_id: existingSubscription.id,
            subscription_status: "active",
          };

          if (taxId && taxIdType) {
            updateData.tax_id = taxId;
            updateData.tax_id_type = taxIdType;
          }

          if (address) {
            const addressString = [
              `${address.street}, ${address.number}`,
              address.complement,
              address.neighborhood,
              `${address.city} - ${address.state}`,
              address.zipCode.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2"),
            ]
              .filter(Boolean)
              .join(", ");
            updateData.address = addressString;
          }

          await supabase
            .from("clinics")
            .update(updateData)
            .eq("id", clinicId);
        }

        return NextResponse.json({ 
          success: true,
          subscriptionId: existingSubscription.id,
        });
      }
    }

    const previousSubscriptionId = paymentIntent.metadata?.previous_subscription_id as string | undefined;

    // Verificar se já existe assinatura ativa (evitar duplicação), exceto em troca de plano
    if (!previousSubscriptionId) {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: paymentIntent.customer,
        status: "active",
        limit: 1,
      });

      if (existingSubscriptions.data.length > 0) {
        return NextResponse.json(
          { error: "Já existe uma assinatura ativa para este cliente." },
          { status: 400 }
        );
      }
    }

    // Usar plan_slug do metadata (enviado pelo create-payment-intent)
    const planSlug = (paymentIntent.metadata?.plan_slug as string) || "pro";

    const { data: targetPlan } = await supabase
      .from("plans")
      .select("id, stripe_price_id")
      .eq("slug", planSlug)
      .single();

    if (!targetPlan?.stripe_price_id) {
      return NextResponse.json(
        { error: `Plano "${planSlug}" não configurado.` },
        { status: 500 }
      );
    }

    // Anexar payment method ao customer antes de criar a assinatura
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: paymentIntent.customer,
      });
    } catch (attachErr: any) {
      // Se já está anexado, ignorar o erro
      if (!attachErr.message?.includes("already been attached")) {
        console.error("Erro ao anexar payment method:", attachErr);
        return NextResponse.json(
          { error: "Erro ao anexar método de pagamento ao cliente." },
          { status: 500 }
        );
      }
    }

    // Se Payment Intent ainda não foi confirmado, cancelá-lo
    // porque vamos criar a assinatura que vai processar o pagamento
    if (paymentIntent.status === "requires_payment_method" || paymentIntent.status === "requires_confirmation") {
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch (cancelErr) {
        // Ignorar erro se não conseguir cancelar
        console.log("Não foi possível cancelar Payment Intent:", cancelErr);
      }
    }

    // Criar assinatura diretamente (ela vai cobrar o primeiro pagamento automaticamente)
    // NÃO confirmar o Payment Intent separadamente para evitar cobrança dupla
    const subscription = await stripe.subscriptions.create({
      customer: paymentIntent.customer,
      items: [{ price: targetPlan.stripe_price_id }],
      metadata: { clinic_id: paymentIntent.metadata.clinic_id },
      default_payment_method: paymentMethodId,
    });

    // Atualizar clínica no banco
    const clinicId = paymentIntent.metadata.clinic_id;
    if (clinicId) {
      const updateData: any = {
        plan_id: targetPlan.id,
        stripe_subscription_id: subscription.id,
        subscription_status: "active",
      };

      // Salvar CPF/CNPJ se fornecido
      if (taxId && taxIdType) {
        updateData.tax_id = taxId;
        updateData.tax_id_type = taxIdType;
      }

      // Salvar endereço se fornecido
      if (address) {
        const addressString = [
          `${address.street}, ${address.number}`,
          address.complement,
          address.neighborhood,
          `${address.city} - ${address.state}`,
          address.zipCode.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2"),
        ]
          .filter(Boolean)
          .join(", ");
        updateData.address = addressString;
      }

      await supabase
        .from("clinics")
        .update(updateData)
        .eq("id", clinicId);

      // Troca de plano: cancelar a assinatura antiga para não cobrar em duplicidade
      if (previousSubscriptionId && previousSubscriptionId !== subscription.id) {
        try {
          await stripe.subscriptions.cancel(previousSubscriptionId);
          console.log("Confirm subscription: old subscription canceled (plan change):", previousSubscriptionId);
        } catch (cancelErr) {
          console.error("Error canceling old subscription:", cancelErr);
        }
      }
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
