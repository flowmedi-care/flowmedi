import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getPatientProfileBundle } from "../profile-actions";
import { PacientePerfilClient } from "./paciente-perfil-client";

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
  const canCancelCupom = profile.role === "admin" || profile.role === "secretaria";

  return (
    <PacientePerfilClient
      bundle={bundle}
      canEdit={canEdit}
      canCancelCupom={canCancelCupom}
      userRole={profile.role}
    />
  );
}
