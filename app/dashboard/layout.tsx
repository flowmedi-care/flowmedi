import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";

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
    .select("id, full_name, role, clinic_id")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <DashboardNav user={user} profile={profile} />
      <main className="flex-1 p-4 md:p-6 bg-muted/30">{children}</main>
    </div>
  );
}
