import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getMessageTemplates, getSystemTemplatesForDisplay } from "../actions";
import { TemplatesListClient } from "./templates-list-client";
import { EmailBrandingCard } from "./email-branding-card";

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

  const [savedResult, systemResult] = await Promise.all([
    getMessageTemplates(),
    getSystemTemplatesForDisplay(),
  ]);
  const savedTemplates = savedResult.data || [];
  const systemTemplates = systemResult.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Templates de Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates salvos (seus) e templates do sistema (padrão por evento/canal)
          </p>
        </div>
        <Link href="/dashboard/mensagens/templates/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </Link>
      </div>

      <EmailBrandingCard />

      <TemplatesListClient
        savedTemplates={savedTemplates}
        systemTemplates={systemTemplates}
      />
    </div>
  );
}
