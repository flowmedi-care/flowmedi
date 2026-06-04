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

  const [
    fieldsRes,
    typesRes,
    proceduresRes,
    doctorsRes,
    doctorProceduresRes,
    servicesRes,
    productsRes,
    templatesRaw,
    patientsRes,
  ] = await Promise.all([
    supabase
      .from("patient_custom_fields")
      .select("id, field_name, field_type, field_label, required, options, display_order, include_in_public_form")
      .eq("clinic_id", profile.clinic_id)
      .order("display_order"),
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes")
      .eq("clinic_id", profile.clinic_id)
      .order("name"),
    supabase
      .from("procedures")
      .select("id, name, recommendations, display_order, default_service_id, default_appointment_type_id")
      .eq("clinic_id", profile.clinic_id)
      .order("display_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", profile.clinic_id)
      .eq("role", "medico")
      .order("full_name"),
    supabase
      .from("doctor_procedures")
      .select("procedure_id, doctor_id")
      .eq("clinic_id", profile.clinic_id),
    supabase.from("services").select("id, nome").eq("clinic_id", profile.clinic_id).order("nome"),
    supabase
      .from("products")
      .select("id, name, unit")
      .eq("clinic_id", profile.clinic_id)
      .eq("active", true)
      .order("name"),
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

  const appointmentTypes = (typesRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    duration_minutes: t.duration_minutes ?? 30,
  }));

  const procedures = (proceduresRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    recommendations: p.recommendations ?? null,
    display_order: p.display_order ?? 0,
    default_service_id: p.default_service_id ?? null,
    default_appointment_type_id: p.default_appointment_type_id ?? null,
  }));

  const doctors = (doctorsRes.data ?? []).map((d) => ({
    id: d.id,
    full_name: d.full_name ?? "",
  }));

  const doctorIdsByProcedureId: Record<string, string[]> = {};
  for (const row of doctorProceduresRes.data ?? []) {
    if (!doctorIdsByProcedureId[row.procedure_id]) {
      doctorIdsByProcedureId[row.procedure_id] = [];
    }
    doctorIdsByProcedureId[row.procedure_id].push(row.doctor_id);
  }

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
      appointmentTypes={appointmentTypes}
      procedures={procedures}
      doctors={doctors}
      doctorIdsByProcedureId={doctorIdsByProcedureId}
      services={(servicesRes.data ?? []).map((s) => ({ id: s.id, nome: s.nome }))}
      products={(productsRes.data ?? []).map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
      fichaTemplates={fichaRes.data ?? []}
      formTemplates={formTemplates}
      formPatients={formPatients}
      initialTab={initialTab}
    />
  );
}
