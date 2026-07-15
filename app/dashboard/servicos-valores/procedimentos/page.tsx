import { listClinicalFichaTemplates } from "@/app/dashboard/campos-pacientes/clinical-fichas-actions";
import { requireProcedimentosPageAccess } from "../page-access";
import { ProcedimentosPageClient } from "./procedimentos-page-client";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";

export default async function ServicosValoresProcedimentosPage() {
  const { supabase, clinicId } = await requireProcedimentosPageAccess();

  const [proceduresRes, doctorsRes, doctorProceduresRes, servicesRes, productsRes] =
    await Promise.all([
      supabase
        .from("procedures")
        .select(
          "id, name, recommendations, short_description, how_we_perform, recovery, display_order, default_service_id, duration_minutes"
        )
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

  const procedures = (proceduresRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    recommendations: p.recommendations ?? null,
    short_description: (p as { short_description?: string | null }).short_description ?? null,
    how_we_perform: (p as { how_we_perform?: string | null }).how_we_perform ?? null,
    recovery: (p as { recovery?: string | null }).recovery ?? null,
    display_order: p.display_order ?? 0,
    default_service_id: p.default_service_id ?? null,
    duration_minutes: p.duration_minutes ?? 30,
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
    <PageShell
      header={{
        breadcrumbs: [{ label: "Procedimentos" }],
        title: "Procedimentos",
        description:
          "Cadastre procedimentos clínicos, vincule serviços de cobrança, insumos e profissionais. Na agenda, o Secretário(a) seleciona o procedimento para pré-preencher recomendações, formulários e valores.",
      }}
    >
      <ProcedimentosPageClient
        procedures={procedures}
        doctors={doctors}
        doctorIdsByProcedureId={doctorIdsByProcedureId}
        services={services}
        products={products}
        fichaTemplates={fichaRes.data ?? []}
      />
    </PageShell>
  );
}
