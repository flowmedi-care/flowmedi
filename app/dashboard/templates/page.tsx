import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplatesClient } from "./templates-client";

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

  // Buscar templates existentes
  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, name, channel, type, subject, body, is_active, created_at, updated_at")
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  return (
    <TemplatesClient
      clinicId={profile.clinic_id}
      initialTemplates={templates || []}
    />
  );
}
