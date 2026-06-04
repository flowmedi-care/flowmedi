import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CrmLayout({
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

  if (!profile || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
