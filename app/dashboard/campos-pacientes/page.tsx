import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CamposProcedimentosClient } from "./campos-procedimentos-client";
import { listClinicalFichaTemplates } from "./clinical-fichas-actions";

export default async function CamposPacientesPage() {
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

  const { data: fields } = await supabase
    .from("patient_custom_fields")
    .select("id, field_name, field_type, field_label, required, options, display_order, include_in_public_form")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order");

  const fichaRes = await listClinicalFichaTemplates();

  return (
    <CamposProcedimentosClient
      initialFields={fields ?? []}
      fichaTemplates={fichaRes.data ?? []}
    />
  );
}
