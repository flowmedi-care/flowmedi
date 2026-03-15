import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import {
  getMessageTemplates,
  getRemoteMetaTemplates,
  getSystemTemplatesForDisplay,
} from "../actions";
import { TemplatesListClient } from "./templates-list-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [savedResult, systemResult, remoteMetaTemplatesResult, whatsappIntegrationResult] = await Promise.all([
    getMessageTemplates(),
    getSystemTemplatesForDisplay(),
    getRemoteMetaTemplates(),
    supabase
      .from("clinic_integrations")
      .select("id")
      .eq("clinic_id", profile.clinic_id)
      .eq("integration_type", "whatsapp_meta")
      .eq("status", "connected")
      .limit(1),
  ]);
  const savedTemplates = savedResult.data || [];
  const systemTemplates = systemResult.data || [];
  const remoteMetaTemplates = remoteMetaTemplatesResult.data || [];
  const hasWhatsAppIntegration = (whatsappIntegrationResult.data?.length ?? 0) > 0;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Templates de Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates salvos (seus) e templates do sistema (padrão por evento/canal)
          </p>
        </div>
        {canCreateTemplates ? (
          <Link href="/dashboard/mensagens/templates/novo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </Link>
        ) : (
          <Button variant="outline" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {!canCreateTemplates && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Os templates já estão visíveis para sua equipe. Ao evoluir de plano, você poderá criar, editar e ativar envios automáticos.
        </div>
      )}

      <TemplatesListClient
        savedTemplates={savedTemplates}
        systemTemplates={systemTemplates}
        remoteMetaTemplates={remoteMetaTemplates}
        hasWhatsAppIntegration={hasWhatsAppIntegration}
        canCreateTemplates={canCreateTemplates}
        canUseEmailTemplates={canUseEmailTemplates}
        canUseWhatsAppTemplates={canUseWhatsAppTemplates}
      />
    </div>
  );
}
