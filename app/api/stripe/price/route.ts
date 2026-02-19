import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function GET() {
  const supabase = await createClient();
  
  const { data: proPlan } = await supabase
    .from("plans")
    .select("stripe_price_id")
    .eq("slug", "pro")
    .single();

  if (!proPlan?.stripe_price_id) {
    return NextResponse.json({ price: null, formatted: null });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ price: null, formatted: null });
  }

  try {
    const price = await stripe.prices.retrieve(proPlan.stripe_price_id);
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
      },
      formatted,
    });
  } catch (err) {
    console.error("Stripe price retrieve error:", err);
    return NextResponse.json({ price: null, formatted: null });
  }
}
