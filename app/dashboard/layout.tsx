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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, clinic_id, active")
    .eq("id", user.id)
    .single();

  if (profile?.active === false) {
    redirect("/acesso-removido");
  }

  const profileSafe = profile
    ? { ...profile, active: profile.active ?? true }
    : null;

  if (!profile) {
    return (
      <div className="min-h-screen bg-muted/30">
        {children}
      </div>
    );
  }

  return (
    <DashboardLayoutClient user={user} profile={profileSafe}>
      {children}
    </DashboardLayoutClient>
  );
}
