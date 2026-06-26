import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app-page-header";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import { getMessageEvents, getMessageTemplate, getMessageTemplates } from "../../actions";
import { TemplatesListClient } from "../templates-list-client";
import { NewTemplateWizardModal } from "../new-template-wizard-modal";

export const dynamic = "force-dynamic";

export default async function TemplatesSalvosPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editId } = await searchParams;
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

  const [savedResult, eventsResult, editTemplateResult] = await Promise.all([
    getMessageTemplates(),
    getMessageEvents(),
    editId ? getMessageTemplate(editId) : Promise.resolve({ data: null, error: null }),
  ]);
  const savedTemplates = savedResult.data || [];
  const events = eventsResult.data || [];
  const initialEditTemplate = editTemplateResult.data ?? null;

  if (editId && !initialEditTemplate) {
    redirect("/dashboard/mensagens/templates/salvos");
  }

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
          { label: "Templates salvos" },
        ]}
        backHref="/dashboard/mensagens/templates"
        title="Templates salvos"
        description="Templates criados/editados pela sua clínica."
        actions={
          canCreateTemplates ? (
            <NewTemplateWizardModal
              events={events}
              canUseEmailTemplates={canUseEmailTemplates}
              canUseWhatsAppTemplates={canUseWhatsAppTemplates}
              triggerLabel="Novo Template"
            />
          ) : undefined
        }
      />

      <TemplatesListClient
        savedTemplates={savedTemplates}
        systemTemplates={[]}
        remoteMetaTemplates={[]}
        hasWhatsAppIntegration={false}
        canCreateTemplates={canCreateTemplates}
        canUseEmailTemplates={canUseEmailTemplates}
        canUseWhatsAppTemplates={canUseWhatsAppTemplates}
        events={events}
        mode="saved"
        initialEditTemplate={initialEditTemplate}
      />
    </div>
  );
}
