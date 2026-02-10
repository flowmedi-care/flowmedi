import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioEditor } from "../formulario-editor";

export default async function NovoFormularioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: types } = await supabase
    .from("appointment_types")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", profile.clinic_id)
    .eq("role", "medico")
    .order("full_name");

  return (
    <FormularioEditor
      templateId={null}
      initialName=""
      initialDefinition={[]}
      initialAppointmentTypeId={null}
      appointmentTypes={(types ?? []).map((t) => ({ id: t.id, name: t.name }))}
      doctors={(doctors ?? []).map((d) => ({ id: d.id, full_name: d.full_name }))}
    />
  );
}
