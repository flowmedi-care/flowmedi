import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, logo_url, logo_scale, phone, email, address, compliance_confirmation_days, compliance_form_days")
    .eq("id", profile.clinic_id)
    .single();

  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ConfiguracoesClient
        clinicName={clinic?.name ?? null}
        clinicLogoUrl={clinic?.logo_url ?? null}
        clinicLogoScale={clinic?.logo_scale ?? 100}
        clinicPhone={clinic?.phone ?? null}
        clinicEmail={clinic?.email ?? null}
        clinicAddress={clinic?.address ?? null}
        complianceConfirmationDays={clinic?.compliance_confirmation_days ?? null}
        complianceFormDays={clinic?.compliance_form_days ?? null}
        clinicId={profile.clinic_id}
      />
    </Suspense>
  );
}
