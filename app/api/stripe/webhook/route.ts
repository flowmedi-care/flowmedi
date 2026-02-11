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

  const updateClinicPlan = async (
    clinicId: string,
    planSlug: "starter" | "pro",
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clinicId =
          session.metadata?.clinic_id ??
          session.client_reference_id ??
          (await findClinicIdByCustomer(session.customer as string | null));
        if (!clinicId) break;
        const { data: proPlan, error: proPlanError } = await supabase
          .from("plans")
          .select("id")
          .eq("slug", "pro")
          .single();
        if (proPlanError) {
          console.error("Webhook pro plan lookup error:", proPlanError);
          break;
        }
        if (!proPlan) break;
        const subId = session.subscription as string | null;
        const { error: updateError } = await supabase
          .from("clinics")
          .update({
            plan_id: proPlan.id,
            stripe_subscription_id: subId,
            subscription_status: "active",
          })
          .eq("id", clinicId);
        if (updateError) {
          console.error("Webhook clinic update error:", updateError);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const clinicId =
          sub.metadata?.clinic_id ??
          (await findClinicIdByCustomer(sub.customer as string | null));
        if (!clinicId) break;
        if (sub.status === "active") {
          const { data: plan, error: planError } = await supabase
            .from("plans")
            .select("id")
            .eq("slug", "pro")
            .single();
          if (planError) {
            console.error("Webhook pro plan lookup error:", planError);
            break;
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
          await updateClinicPlan(clinicId, "starter", "canceled");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clinicId =
          sub.metadata?.clinic_id ??
          (await findClinicIdByCustomer(sub.customer as string | null));
        if (!clinicId) break;
        await updateClinicPlan(clinicId, "starter", "canceled");
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
