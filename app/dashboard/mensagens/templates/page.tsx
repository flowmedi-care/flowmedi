import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getMessageTemplates, getMessageEvents } from "../actions";
import { TemplatesListClient } from "./templates-list-client";

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

  const [templatesResult, eventsResult] = await Promise.all([
    getMessageTemplates(),
    getMessageEvents(),
  ]);

  const templates = templatesResult.data || [];
  const events = eventsResult.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Templates de Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e edite templates para email e WhatsApp
          </p>
        </div>
        <Link href="/dashboard/mensagens/templates/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </Link>
      </div>
      <TemplatesListClient templates={templates} events={events} />
    </div>
  );
}
