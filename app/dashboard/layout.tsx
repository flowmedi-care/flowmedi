import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canAccessAudit, canUseWhatsApp } from "@/lib/plan-gates";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  // Buscar profile sem cache para garantir dados atualizados
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, clinic_id, active")
    .eq("id", user.id)
    .single();

  // Redirecionar system_admin para /admin/system
  if (profile?.role === "system_admin") {
    redirect("/admin/system");
  }

  if (profile?.active === false) {
    redirect("/acesso-removido");
  }

  const profileSafe = profile
    ? { ...profile, active: profile.active ?? true }
    : null;

  const planData = await getClinicPlanData();
  const auditEnabled = Boolean(planData && canAccessAudit(planData.limits));
  const whatsappEnabledByPlan = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );
  const { data: clinic } = profile?.clinic_id
    ? await supabase
        .from("clinics")
        .select("services_pricing_mode")
        .eq("id", profile.clinic_id)
        .single()
    : { data: null };
  const servicesPricingMode =
    clinic?.services_pricing_mode === "centralizado" ? "centralizado" : "descentralizado";

  // Sempre renderizar o layout com sidebar quando há usuário autenticado
  // Mesmo sem profile, para garantir consistência visual
  return (
    <DashboardLayoutClient
      user={user}
      profile={profileSafe}
      canAccessAudit={auditEnabled}
      canUseWhatsApp={whatsappEnabledByPlan}
      servicesPricingMode={servicesPricingMode}
    >
      {children}
    </DashboardLayoutClient>
  );
}
