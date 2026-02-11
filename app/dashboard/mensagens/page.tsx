import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MensagensClient } from "./mensagens-client";
import {
  getMessageEvents,
  getClinicMessageSettings,
  getMessageTemplates,
} from "./actions";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function MensagensPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  // Apenas admin pode configurar mensagens
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Buscar dados
  const [eventsResult, settingsResult, templatesResult] = await Promise.all([
    getMessageEvents(),
    getClinicMessageSettings(),
    getMessageTemplates(),
  ]);

  const events = eventsResult.data || [];
  const settings = settingsResult.data || [];
  const templates = templatesResult.data || [];

  return (
    <ErrorBoundary>
      <MensagensClient
        events={events}
        settings={settings}
        templates={templates}
      />
    </ErrorBoundary>
  );
}
