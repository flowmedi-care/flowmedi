import { listClinicalFichaTemplates } from "@/app/dashboard/campos-pacientes/clinical-fichas-actions";
import { requireProcedimentosPageAccess } from "../page-access";
import { ProcedimentosPageClient } from "./procedimentos-page-client";

export default async function ServicosValoresProcedimentosPage() {
  const { supabase, clinicId } = await requireProcedimentosPageAccess();

  const [
    typesRes,
    proceduresRes,
    doctorsRes,
    doctorProceduresRes,
    servicesRes,
    productsRes,
  ] = await Promise.all([
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes")
      .eq("clinic_id", clinicId)
      .order("name"),
    supabase
      .from("procedures")
      .select("id, name, recommendations, display_order, default_service_id, default_appointment_type_id")
      .eq("clinic_id", clinicId)
      .order("display_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("role", "medico")
      .order("full_name"),
    supabase
      .from("doctor_procedures")
      .select("procedure_id, doctor_id")
      .eq("clinic_id", clinicId),
    supabase
      .from("services")
      .select("id, nome, recurrence_billing_mode")
      .eq("clinic_id", clinicId)
      .order("nome"),
    supabase
      .from("products")
      .select("id, name, unit")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("name"),
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

  const services = (servicesRes.data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    recurrence_billing_mode:
      s.recurrence_billing_mode === "per_session" ||
      s.recurrence_billing_mode === "treatment_plan"
        ? s.recurrence_billing_mode
        : null,
  }));

  const products = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
  }));

  const fichaRes = await listClinicalFichaTemplates();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Procedimentos</h1>
        <p className="text-muted-foreground max-w-2xl">
          Cadastre procedimentos clínicos, vincule serviços de cobrança, insumos e profissionais.
          Na agenda, o Secretário(a) seleciona o procedimento para pré-preencher recomendações, formulários e valores.
        </p>
      </header>
      <ProcedimentosPageClient
        procedures={procedures}
        doctors={doctors}
        doctorIdsByProcedureId={doctorIdsByProcedureId}
        appointmentTypes={appointmentTypes}
        services={services}
        products={products}
        fichaTemplates={fichaRes.data ?? []}
      />
    </div>
  );
}
