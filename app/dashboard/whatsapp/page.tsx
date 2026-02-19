import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings } from "lucide-react";
import { WhatsAppChatSidebar } from "@/components/whatsapp-chat-sidebar";

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

  const { data: integration } = await supabase
    .from("clinic_integrations")
    .select("id, metadata")
    .eq("clinic_id", profile.clinic_id)
    .eq("integration_type", "whatsapp_simple")
    .eq("status", "connected")
    .single();

  if (!integration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">WhatsApp não conectado</h2>
        <p className="text-muted-foreground max-w-md">
          Conecte a integração WhatsApp Simples em Configurações para ver e enviar conversas aqui.
          O token e o número são salvos automaticamente ao conectar.
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
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[400px] -m-2 sm:-m-4 md:-m-6 lg:-m-8">
      <div className="flex-1 flex min-h-0 rounded-lg overflow-hidden border border-border bg-card">
        <WhatsAppChatSidebar fullWidth />
      </div>
    </div>
  );
}
