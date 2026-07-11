import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CamposProcedimentosClient } from "../../campos-pacientes/campos-procedimentos-client";
import { listClinicalFichaTemplates } from "../../campos-pacientes/clinical-fichas-actions";

export default async function CamposPersonalizadosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [fieldsRes, templatesRaw, patientsRes] = await Promise.all([
    supabase
      .from("patient_custom_fields")
      .select("id, field_name, field_type, field_label, required, options, display_order, include_in_public_form, whatsapp_policy")
      .eq("clinic_id", profile.clinic_id)
      .order("display_order"),
    supabase
      .from("form_templates")
      .select(`
        id,
        name,
        appointment_type_id,
        is_public,
        appointment_types ( name )
      `)
      .eq("clinic_id", profile.clinic_id)
      .order("name"),
    supabase
      .from("patients")
      .select("id, full_name")
      .eq("clinic_id", profile.clinic_id)
      .order("full_name"),
  ]);

  const formTemplates = (templatesRaw.data ?? []).map((t: Record<string, unknown>) => {
    const at = Array.isArray(t.appointment_types) ? t.appointment_types[0] : t.appointment_types;
    return {
      id: String(t.id),
      name: String(t.name),
      appointment_type_name: (at as { name?: string } | null)?.name ?? null,
      is_public: Boolean(t.is_public ?? false),
    };
  });

  const formPatients = (patientsRes.data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
  }));

  const fichaRes = await listClinicalFichaTemplates();
  const initialTab = params.tab === "formularios" ? "formularios" : undefined;

  return (
    <CamposProcedimentosClient
      initialFields={fieldsRes.data ?? []}
      fichaTemplates={fichaRes.data ?? []}
      formTemplates={formTemplates}
      formPatients={formPatients}
      initialTab={initialTab}
    />
  );
}
