import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  // Buscar profile sem cache para garantir dados atualizados
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, clinic_id, active")
    .eq("id", user.id)
    .single();

  // Redirecionar system_admin para /admin/system
  if (profile?.role === "system_admin") {
    redirect("/admin/system");
  }

  if (profile?.active === false) {
    redirect("/acesso-removido");
  }

  const profileSafe = profile
    ? { ...profile, active: profile.active ?? true }
    : null;

  // Buscar logo da clínica
  let logoUrl: string | null = null;
  if (profileSafe?.clinic_id) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("logo_url")
      .eq("id", profileSafe.clinic_id)
      .single();
    logoUrl = clinic?.logo_url ?? null;
  }

  // Sempre renderizar o layout com sidebar quando há usuário autenticado
  // Mesmo sem profile, para garantir consistência visual
  return (
    <DashboardLayoutClient user={user} profile={profileSafe} logoUrl={logoUrl}>
      {children}
    </DashboardLayoutClient>
  );
}
