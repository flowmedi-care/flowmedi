import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanoClient } from "./plano-client";

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const selectedPlanSlug = params.plan?.trim().toLowerCase() || null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?redirect=/dashboard/plano");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  if (!profile.clinic_id) {
    redirect("/dashboard/onboarding");
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("plan_id, subscription_status, stripe_subscription_id")
    .eq("id", profile.clinic_id)
    .single();

  const planId = clinic?.plan_id ?? null;
  const { data: planRow } = planId
    ? await supabase.from("plans").select("name, slug, stripe_price_id").eq("id", planId).single()
    : { data: null };

  const { data: proPlan } = await supabase
    .from("plans")
    .select("stripe_price_id")
    .eq("slug", "pro")
    .single();

  // Buscar todos os planos exibidos na página de preços (para o usuário escolher)
  const { data: upgradePlans } = await supabase
    .from("plans")
    .select("id, name, slug, stripe_price_id, price_display")
    .eq("show_on_pricing", true)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const planInfo = {
    planName: planRow?.name ?? "Starter",
    planSlug: planRow?.slug ?? "starter",
    subscriptionStatus: clinic?.subscription_status ?? null,
    stripeSubscriptionId: clinic?.stripe_subscription_id ?? null,
    proStripePriceId: proPlan?.stripe_price_id ?? null,
    selectedPlanSlug,
    upgradePlans: upgradePlans ?? [],
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Plano e pagamento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie sua assinatura, faturas e forma de pagamento.
        </p>
      </div>
      <PlanoClient plan={planInfo} />
    </div>
  );
}
