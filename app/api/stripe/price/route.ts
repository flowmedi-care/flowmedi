import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { parseBillingCycle, resolveStripePriceId } from "@/lib/billing-cycle";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const planSlug = searchParams.get("plan")?.trim().toLowerCase() || "pro";
  const billingCycle = parseBillingCycle(
    searchParams.get("cycle") ?? searchParams.get("billingCycle")
  );

  const { data: plan } = await supabase
    .from("plans")
    .select("stripe_price_id, stripe_price_id_monthly, stripe_price_id_annually")
    .eq("slug", planSlug)
    .single();

  const stripePriceId = plan ? resolveStripePriceId(plan, billingCycle) : null;

  if (!stripePriceId) {
    return NextResponse.json({ price: null, formatted: null, billingCycle });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ price: null, formatted: null, billingCycle });
  }

  try {
    const price = await stripe.prices.retrieve(stripePriceId);
    const amount = price.unit_amount ?? 0;
    const currency = price.currency ?? "brl";

    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);

    return NextResponse.json({
      price: {
        amount,
        currency,
        id: price.id,
        interval: price.recurring?.interval ?? null,
      },
      formatted,
      billingCycle,
    });
  } catch (err) {
    console.error("Stripe price retrieve error:", err);
    return NextResponse.json({ price: null, formatted: null, billingCycle });
  }
}
