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

  try {
    const list = await stripe.invoices.list({
      customer: clinic.stripe_customer_id,
      limit: 24,
      expand: ["data.lines.data.price.product"],
    });

    type LineWithPrice = { price?: { product?: string | { name?: string } }; description?: string };
    const invoices = list.data.map((inv) => {
      const firstLine = inv.lines?.data?.[0] as LineWithPrice | undefined;
      const rawProduct = firstLine?.price?.product;
      const productName =
        typeof rawProduct === "object" && rawProduct && "name" in rawProduct
          ? (rawProduct.name as string)
          : null;
      const description = productName || firstLine?.description || "Assinatura";

      return {
        id: inv.id,
        number: inv.number ?? undefined,
        created: inv.created,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        hosted_invoice_url: inv.hosted_invoice_url ?? undefined,
        period_start: inv.period_start,
        period_end: inv.period_end,
        description,
      };
    });

    return NextResponse.json({ invoices });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erro ao buscar faturas.";
    
    // Se o customer não existe (modo teste vs produção), limpar do banco
    if (errorMessage.includes("No such customer")) {
      await supabase
        .from("clinics")
        .update({ stripe_customer_id: null })
        .eq("id", profile.clinic_id);
      
      return NextResponse.json({ invoices: [] });
    }
    
    console.error("Stripe invoices error:", err);
    return NextResponse.json({ invoices: [] });
  }
}
