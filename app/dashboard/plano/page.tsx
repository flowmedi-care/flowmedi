import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanoClient } from "./plano-client";

export default async function PlanoPage() {
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

  const planInfo = {
    planName: planRow?.name ?? "Starter",
    planSlug: planRow?.slug ?? "starter",
    subscriptionStatus: clinic?.subscription_status ?? null,
    stripeSubscriptionId: clinic?.stripe_subscription_id ?? null,
    proStripePriceId: proPlan?.stripe_price_id ?? null,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Plano e pagamento</h1>
      <p className="text-sm text-muted-foreground">
        Apenas o admin da clínica pode alterar o plano, ver faturas e cancelar a assinatura.
      </p>
      <PlanoClient plan={planInfo} />
    </div>
  );
}
