import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe ou webhook não configurado." },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    // Webhook verified.
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase service role não configurado." },
      { status: 500 }
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const findPlanByStripePriceId = async (priceId: string | null) => {
    if (!priceId) return null;
    const { data } = await supabase
      .from("plans")
      .select("id")
      .eq("stripe_price_id", priceId)
      .single();
    return data;
  };

  const updateClinicPlan = async (
    clinicId: string,
    planSlug: "starter" | "pro" | string,
    subscriptionStatus: string | null
  ) => {
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id")
      .eq("slug", planSlug)
      .single();
    if (planError) {
      console.error("Webhook plan lookup error:", planError);
      return;
    }
    if (!plan) return;
    const { error: updateError } = await supabase
      .from("clinics")
      .update({
        plan_id: plan.id,
        subscription_status: subscriptionStatus,
        ...(planSlug === "starter"
          ? { stripe_subscription_id: null }
          : {}),
      })
      .eq("id", clinicId);
    if (updateError) {
      console.error("Webhook clinic update error:", updateError);
    }
  };

  const findClinicIdByCustomer = async (customerId?: string | null) => {
    if (!customerId) return null;
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();
    return clinic?.id ?? null;
  };

  /** Só rebaixa para starter se a assinatura que foi cancelada/deletada for a que está salva na clínica (evita sobrescrever após troca de plano). */
  const shouldDowngradeClinicToStarter = async (clinicId: string, subscriptionId: string) => {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("stripe_subscription_id")
      .eq("id", clinicId)
      .single();
    return clinic?.stripe_subscription_id === subscriptionId;
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clinicId =
          session.metadata?.clinic_id ??
          session.client_reference_id ??
          (await findClinicIdByCustomer(session.customer as string | null));
        if (!clinicId) break;
        const subId = session.subscription as string | null;
        let planId: string | null = null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items?.data?.[0]?.price?.id ?? null;
          const plan = await findPlanByStripePriceId(priceId);
          planId = plan?.id ?? null;
        }
        if (!planId) {
          const { data: proPlan } = await supabase
            .from("plans")
            .select("id")
            .eq("slug", "pro")
            .single();
          planId = proPlan?.id ?? null;
        }
        if (!planId) break;
        
        // Buscar tax_id (CPF/CNPJ) do customer se disponível
        let taxId: string | null = null;
        let taxIdType: "cpf" | "cnpj" | null = null;
        if (session.customer && typeof session.customer === "string") {
          try {
            const customer = await stripe.customers.retrieve(session.customer);
            if (!customer.deleted && customer.tax_ids?.data && customer.tax_ids.data.length > 0) {
              const taxIdObj = customer.tax_ids.data[0];
              taxId = taxIdObj.value;
              // Determinar tipo baseado no tipo do Stripe
              if (taxIdObj.type === "br_cnpj") {
                taxIdType = "cnpj";
              } else if (taxIdObj.type === "br_cpf") {
                taxIdType = "cpf";
              }
            }
          } catch (err) {
            console.error("Webhook error fetching customer tax_id:", err);
            // Não falhar o webhook se não conseguir buscar tax_id
          }
        }
        
        const updateData: Record<string, unknown> = {
          plan_id: planId,
          stripe_subscription_id: subId,
          subscription_status: "active",
        };
        
        // Adicionar tax_id se disponível (só atualiza se a coluna existir)
        if (taxId && taxIdType) {
          updateData.tax_id = taxId;
          updateData.tax_id_type = taxIdType;
        }
        
        const { error: updateError } = await supabase
          .from("clinics")
          .update(updateData)
          .eq("id", clinicId);
        if (updateError) {
          console.error("Webhook clinic update error:", updateError);
        } else {
          console.log("Webhook clinic updated to pro:", { clinicId, subId, taxId, taxIdType });
        }

        // Troca de plano: cancelar a assinatura antiga para não cobrar em duplicidade
        const previousSubId = session.metadata?.previous_subscription_id;
        if (session.metadata?.plan_change === "1" && previousSubId && previousSubId !== subId) {
          try {
            await stripe.subscriptions.cancel(previousSubId);
            console.log("Webhook plan change: old subscription canceled:", previousSubId);
          } catch (cancelErr) {
            console.error("Webhook error canceling old subscription:", cancelErr);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const clinicId =
          sub.metadata?.clinic_id ??
          (await findClinicIdByCustomer(sub.customer as string | null));
        console.log("customer.subscription.updated clinicId:", {
          clinicId,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        if (!clinicId) break;
        if (sub.status === "active") {
          const priceId = sub.items?.data?.[0]?.price?.id ?? null;
          let plan = await findPlanByStripePriceId(priceId);
          if (!plan) {
            const { data: proPlan } = await supabase
              .from("plans")
              .select("id")
              .eq("slug", "pro")
              .single();
            plan = proPlan;
          }
          if (plan) {
            const { error: updateError } = await supabase
              .from("clinics")
              .update({
                plan_id: plan.id,
                stripe_subscription_id: sub.id,
                subscription_status: "active",
              })
              .eq("id", clinicId);
            if (updateError) {
              console.error("Webhook clinic update error:", updateError);
            }
          }
        } else if (sub.status === "past_due" || sub.status === "unpaid") {
          const { error: updateError } = await supabase
            .from("clinics")
            .update({ subscription_status: sub.status })
            .eq("id", clinicId);
          if (updateError) {
            console.error("Webhook clinic update error:", updateError);
          }
        } else if (sub.status === "canceled") {
          const isCurrentSubscription = await shouldDowngradeClinicToStarter(clinicId, sub.id);
          if (isCurrentSubscription) {
            await updateClinicPlan(clinicId, "starter", "canceled");
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clinicId =
          sub.metadata?.clinic_id ??
          (await findClinicIdByCustomer(sub.customer as string | null));
        if (!clinicId) break;
        const isCurrentSubscription = await shouldDowngradeClinicToStarter(clinicId, sub.id);
        if (isCurrentSubscription) {
          await updateClinicPlan(clinicId, "starter", "canceled");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string | null }).subscription ?? null;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const clinicId =
          sub.metadata?.clinic_id ??
          (await findClinicIdByCustomer(sub.customer as string | null));
        if (!clinicId) break;
        const { error: updateError } = await supabase
          .from("clinics")
          .update({ subscription_status: "past_due" })
          .eq("id", clinicId);
        if (updateError) {
          console.error("Webhook clinic update error:", updateError);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
