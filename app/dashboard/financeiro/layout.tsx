import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FinanceAlertsPanelServer } from "./finance-alerts-panel-server";

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <FinanceAlertsPanelServer />
      {children}
    </div>
  );
}
