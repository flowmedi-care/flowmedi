import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SecretariasMedicosClient } from "./secretarias-medicos-client";

export default async function SecretariasMedicosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.clinic_id) redirect("/dashboard");

  const clinicId = profile.clinic_id;

  const { data: secretaries } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("clinic_id", clinicId)
    .eq("role", "secretaria")
    .order("full_name");

  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  const { data: secretaryDoctors } = await supabase
    .from("secretary_doctors")
    .select("secretary_id, doctor_id")
    .eq("clinic_id", clinicId);

  const bySecretary: Record<string, string[]> = {};
  for (const row of secretaryDoctors ?? []) {
    if (!bySecretary[row.secretary_id]) bySecretary[row.secretary_id] = [];
    bySecretary[row.secretary_id].push(row.doctor_id);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Secretárias × Médicos</h1>
      <SecretariasMedicosClient
        clinicId={clinicId}
        secretaries={(secretaries ?? []).map((s) => ({
          id: s.id,
          full_name: s.full_name ?? "",
          email: s.email ?? undefined,
        }))}
        doctors={(doctors ?? []).map((d) => ({ id: d.id, full_name: d.full_name ?? "" }))}
        initialAssignments={bySecretary}
      />
    </div>
  );
}
