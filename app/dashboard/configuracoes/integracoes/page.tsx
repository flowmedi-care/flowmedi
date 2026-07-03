import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IntegracoesPageClient } from "./integracoes-page-client";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import { SettingsPageSkeleton } from "@/components/dashboard-ui/loading/settings-page-skeleton";

export default async function ConfiguracoesIntegracoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const planData = await getClinicPlanData();
  const canUseWhatsAppByPlan = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );
  const canUseEmailByPlan = Boolean(
    planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );

  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <IntegracoesPageClient
        clinicId={profile.clinic_id}
        canUseWhatsApp={canUseWhatsAppByPlan}
        canUseEmail={canUseEmailByPlan}
      />
    </Suspense>
  );
}
