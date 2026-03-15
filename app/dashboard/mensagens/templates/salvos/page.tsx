import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import { getMessageTemplates } from "../../actions";
import { TemplatesListClient } from "../templates-list-client";

export const dynamic = "force-dynamic";

export default async function TemplatesSalvosPage() {
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

  const savedResult = await getMessageTemplates();
  const savedTemplates = savedResult.data || [];
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Templates salvos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates criados/editados pela sua clínica.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/mensagens/templates">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          {canCreateTemplates ? (
            <Link href="/dashboard/mensagens/templates/novo">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <TemplatesListClient
        savedTemplates={savedTemplates}
        systemTemplates={[]}
        remoteMetaTemplates={[]}
        hasWhatsAppIntegration={false}
        canCreateTemplates={canCreateTemplates}
        canUseEmailTemplates={canUseEmailTemplates}
        canUseWhatsAppTemplates={canUseWhatsAppTemplates}
        mode="saved"
      />
    </div>
  );
}
