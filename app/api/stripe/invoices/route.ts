import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function GET() {
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
    return NextResponse.json({ error: "Apenas admin pode ver faturas." }, { status: 403 });
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("stripe_customer_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ invoices: [] });
  }

  const list = await stripe.invoices.list({
    customer: clinic.stripe_customer_id,
    limit: 24,
  });

  const invoices = list.data.map((inv) => ({
    id: inv.id,
    number: inv.number ?? undefined,
    created: inv.created,
    amount_paid: inv.amount_paid,
    currency: inv.currency,
    status: inv.status,
    hosted_invoice_url: inv.hosted_invoice_url ?? undefined,
    period_start: inv.period_start,
    period_end: inv.period_end,
  }));

  return NextResponse.json({ invoices });
}
