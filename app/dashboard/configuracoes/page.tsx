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

  const { data: clinic } = await supabase
    .from("clinics")
    .select("logo_url, logo_scale, compliance_confirmation_days")
    .eq("id", profile.clinic_id)
    .single();

  return (
    <ConfiguracoesClient
        appointmentTypes={(types ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          duration_minutes: t.duration_minutes ?? 30,
        }))}
        clinicLogoUrl={clinic?.logo_url ?? null}
        clinicLogoScale={clinic?.logo_scale ?? 100}
        complianceConfirmationDays={clinic?.compliance_confirmation_days ?? null}
        clinicId={profile.clinic_id}
      />
  );
}
