import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app-page-header";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import { getMessageEvents, getSystemTemplatesForDisplay } from "../../actions";
import { TemplatesListClient } from "../templates-list-client";

export const dynamic = "force-dynamic";

export default async function TemplatesSistemaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [systemResult, eventsResult] = await Promise.all([
    getSystemTemplatesForDisplay(),
    getMessageEvents(),
  ]);
  const systemTemplates = systemResult.data || [];
  const events = eventsResult.data || [];
  const planData = await getClinicPlanData();
  const canUseEmailTemplates = Boolean(
    planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  const canUseWhatsAppTemplates = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );
  const canCreateTemplates = canUseEmailTemplates || canUseWhatsAppTemplates;

  return (
    <div className="space-y-6">
      <AppPageHeader
        breadcrumbs={[
          { label: "Templates", href: "/dashboard/mensagens/templates" },
          { label: "Templates do sistema" },
        ]}
        backHref="/dashboard/mensagens/templates"
        title="Templates do sistema"
        description="Modelos padrão por evento/canal para copiar e personalizar."
      />

      <TemplatesListClient
        savedTemplates={[]}
        systemTemplates={systemTemplates}
        remoteMetaTemplates={[]}
        hasWhatsAppIntegration={false}
        canCreateTemplates={canCreateTemplates}
        canUseEmailTemplates={canUseEmailTemplates}
        canUseWhatsAppTemplates={canUseWhatsAppTemplates}
        events={events}
        mode="system"
      />
    </div>
  );
}
