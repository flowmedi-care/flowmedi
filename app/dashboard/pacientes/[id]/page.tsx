import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getPatientProfileBundle } from "../profile-actions";
import { PacientePerfilClient } from "./paciente-perfil-client";
import { getPatientConsentsAction } from "../consent-actions";
import { getClinicConsentSettings } from "@/lib/consent/consent-service";

export default async function PacientePerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { error, data: bundle } = await getPatientProfileBundle(id);
  if (error || !bundle) notFound();

  const canEdit = profile.role === "admin" || profile.role === "secretaria" || profile.role === "medico";
  const canCancelComanda = profile.role === "admin" || profile.role === "secretaria";

  const [consentsRes, consentSettings] = await Promise.all([
    getPatientConsentsAction(id),
    getClinicConsentSettings(supabase, profile.clinic_id),
  ]);

  return (
    <PacientePerfilClient
      bundle={bundle}
      canEdit={canEdit}
      canCancelComanda={canCancelComanda}
      userRole={profile.role}
      patientConsents={consentsRes.data ?? []}
      defaultConsentText={
        consentSettings.default_consent_text ??
        "Autorizo o recebimento de comunicações de marketing e promoções da clínica por e-mail e WhatsApp."
      }
    />
  );
}
