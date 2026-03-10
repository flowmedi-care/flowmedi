import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings } from "lucide-react";
import { WhatsAppChatSidebar } from "@/components/whatsapp-chat-sidebar";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseWhatsApp } from "@/lib/plan-gates";

export default async function WhatsAppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id, active")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.active === false) {
    redirect("/dashboard");
  }

  const planData = await getClinicPlanData();
  const whatsappAllowed = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );

  if (!whatsappAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">WhatsApp disponivel no plano pago</h2>
        <p className="text-muted-foreground max-w-md">
          Seu plano atual permite visualizar esta tela, mas o envio e a central de conversas
          ficam liberados apenas no plano pago.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracoes">
              <Settings className="h-4 w-4 mr-2" />
              Ver configuracoes
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/plano">Ver planos</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { data: integrations } = await supabase
    .from("clinic_integrations")
    .select("id, integration_type, metadata")
    .eq("clinic_id", profile.clinic_id)
    .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
    .eq("status", "connected")
    .limit(2);

  const integration =
    integrations?.find((row) => row.integration_type === "whatsapp_meta") ??
    integrations?.find((row) => row.integration_type === "whatsapp_simple") ??
    null;

  if (!integration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">WhatsApp não conectado</h2>
        <p className="text-muted-foreground max-w-md">
          Conecte o WhatsApp em Configurações para ver e enviar conversas aqui.
          O token e o número são salvos automaticamente ao conectar via Meta.
        </p>
        <Button asChild>
          <Link href="/dashboard/configuracoes">
            <Settings className="h-4 w-4 mr-2" />
            Ir para Configurações
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 w-full overflow-hidden">
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden w-full">
        <WhatsAppChatSidebar fullWidth />
      </div>
    </div>
  );
}
