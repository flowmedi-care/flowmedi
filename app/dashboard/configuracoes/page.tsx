import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConfiguracoesClient } from "./configuracoes-client";

export default async function ConfiguracoesPage() {
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

  const { data: types } = await supabase
    .from("appointment_types")
    .select("id, name, duration_minutes")
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
      <ConfiguracoesClient
        appointmentTypes={(types ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          duration_minutes: t.duration_minutes ?? 30,
        }))}
      />
    </div>
  );
}
