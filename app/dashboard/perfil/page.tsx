import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PerfilClient } from "./perfil-client";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, logo_url, logo_scale")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  // Apenas médicos podem fazer upload da logo
  if (profile.role !== "medico") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Meu Perfil</h1>
      <PerfilClient 
        doctorLogoUrl={profile.logo_url ?? null} 
        doctorLogoScale={profile.logo_scale ?? 100}
      />
    </div>
  );
}
