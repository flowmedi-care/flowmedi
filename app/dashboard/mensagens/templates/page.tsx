import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, Layers, MessageSquareCode, Plus } from "lucide-react";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import {
  getMessageTemplates,
  getRemoteMetaTemplates,
  getSystemTemplatesForDisplay,
  getMessageEvents,
} from "../actions";
import { TemplatesListClient } from "./templates-list-client";
import { NewTemplateWizardModal } from "./new-template-wizard-modal";

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

  const [savedResult, systemResult, remoteMetaTemplatesResult, eventsResult, whatsappIntegrationResult] = await Promise.all([
    getMessageTemplates(),
    getSystemTemplatesForDisplay(),
    getRemoteMetaTemplates(),
    getMessageEvents(),
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
  const events = eventsResult.data || [];
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Templates de Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize templates salvos, sistema e Meta em páginas separadas.</p>
        </div>
        {canCreateTemplates ? (
          <NewTemplateWizardModal
            events={events}
            canUseEmailTemplates={canUseEmailTemplates}
            canUseWhatsAppTemplates={canUseWhatsAppTemplates}
            triggerLabel="Novo Template"
          />
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

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-3">
        <Link href="/dashboard/mensagens/templates/salvos">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5 hover:bg-muted/20 transition-colors">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
              <FileText className="h-5 w-5" />
              Templates salvos
            </h2>
            <p className="text-sm text-muted-foreground">
              Os templates criados/editados pela clínica.
            </p>
            <p className="text-xs text-muted-foreground mt-3">{savedTemplates.length} template(s)</p>
          </div>
        </Link>

        <Link href="/dashboard/mensagens/templates/sistema">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5 hover:bg-muted/20 transition-colors">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
              <Layers className="h-5 w-5" />
              Templates do sistema
            </h2>
            <p className="text-sm text-muted-foreground">
              Modelos padrão por evento/canal para copiar e personalizar.
            </p>
            <p className="text-xs text-muted-foreground mt-3">{systemTemplates.length} template(s)</p>
          </div>
        </Link>

        <Link href="/dashboard/mensagens/templates/meta">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5 hover:bg-muted/20 transition-colors">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
              <MessageSquareCode className="h-5 w-5" />
              Modelos de mensagens Meta
            </h2>
            <p className="text-sm text-muted-foreground">
              Crie modelos para submissão à Meta e acompanhe o envio.
            </p>
          </div>
        </Link>
      </div>

      <TemplatesListClient
        savedTemplates={[]}
        systemTemplates={[]}
        remoteMetaTemplates={remoteMetaTemplates}
        hasWhatsAppIntegration={hasWhatsAppIntegration}
        canCreateTemplates={canCreateTemplates}
        canUseEmailTemplates={canUseEmailTemplates}
        canUseWhatsAppTemplates={canUseWhatsAppTemplates}
        mode="metaApproved"
      />
    </div>
  );
}
