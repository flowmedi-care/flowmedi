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

  if (!profile || profile.role !== "admin" || !profile.clinic_id) {
    return NextResponse.json({ error: "Apenas admin pode acessar." }, { status: 403 });
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("stripe_customer_id")
    .eq("id", profile.clinic_id)
    .single();

  if (!clinic?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Nenhum método de pagamento cadastrado." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  // Verificar se o customer existe na Stripe
  try {
    await stripe.customers.retrieve(clinic.stripe_customer_id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "";
    // Se o customer não existe (modo teste vs produção), limpar do banco
    if (errorMessage.includes("No such customer")) {
      await supabase
        .from("clinics")
        .update({ stripe_customer_id: null })
        .eq("id", profile.clinic_id);
      
      return NextResponse.json(
        { error: "Cliente não encontrado na Stripe (pode ter sido criado em modo de teste). Tente criar uma nova assinatura." },
        { status: 404 }
      );
    }
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const returnUrl =
    (body.return_url as string) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: clinic.stripe_customer_id,
      return_url: `${returnUrl}/dashboard/plano`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal session error:", err);
    const message = err instanceof Error ? err.message : "Erro ao criar sessão do portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
