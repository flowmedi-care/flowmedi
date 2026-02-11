import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MensagensClient } from "./mensagens-client";
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
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <ErrorBoundary>
      <MensagensClient />
    </ErrorBoundary>
  );
}
