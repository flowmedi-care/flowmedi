import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ServicosValoresClient } from "./servicos-valores-client";
import { listClinicalFichaTemplates } from "@/app/dashboard/campos-pacientes/clinical-fichas-actions";

export default async function ServicosValoresPage({
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

  if (!profile?.clinic_id || (profile.role !== "admin" && profile.role !== "medico")) {
    redirect("/dashboard");
  }

  const clinicId = profile.clinic_id;
  const isAdmin = profile.role === "admin";
  const { data: clinic } = await supabase
    .from("clinics")
    .select("services_pricing_mode")
    .eq("id", clinicId)
    .single();
  const servicesPricingMode =
    clinic?.services_pricing_mode === "centralizado" ? "centralizado" : "descentralizado";
  if (servicesPricingMode === "centralizado" && profile.role === "medico") {
    redirect("/dashboard");
  }

  const [
    servicesRes,
    dimensionsRes,
    dimensionValuesRes,
    servicePricesRes,
    doctorsRes,
    typesRes,
    proceduresRes,
    doctorProceduresRes,
    productsRes,
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, nome, categoria, recurrence_billing_mode")
      .eq("clinic_id", clinicId)
      .order("nome"),
    supabase.from("price_dimensions").select("id, nome, ativo").eq("clinic_id", clinicId).order("nome"),
    supabase.from("dimension_values").select("id, dimension_id, nome, ativo, cor").eq("clinic_id", clinicId).order("nome"),
    supabase
      .from("service_prices")
      .select("id, service_id, professional_id, valor, ativo")
      .eq("clinic_id", clinicId),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("role", "medico").order("full_name"),
    isAdmin
      ? supabase
          .from("appointment_types")
          .select("id, name, duration_minutes")
          .eq("clinic_id", clinicId)
          .order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; duration_minutes: number | null }[] }),
    isAdmin
      ? supabase
          .from("procedures")
          .select("id, name, recommendations, display_order, default_service_id, default_appointment_type_id")
          .eq("clinic_id", clinicId)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string; recommendations: string | null; display_order: number | null; default_service_id: string | null; default_appointment_type_id: string | null }[] }),
    isAdmin
      ? supabase
          .from("doctor_procedures")
          .select("procedure_id, doctor_id")
          .eq("clinic_id", clinicId)
      : Promise.resolve({ data: [] as { procedure_id: string; doctor_id: string }[] }),
    isAdmin
      ? supabase
          .from("products")
          .select("id, name, unit")
          .eq("clinic_id", clinicId)
          .eq("active", true)
          .order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string }[] }),
  ]);

  const services = (servicesRes.data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    categoria: s.categoria ?? null,
    recurrence_billing_mode:
      s.recurrence_billing_mode === "per_session" ||
      s.recurrence_billing_mode === "treatment_plan"
        ? s.recurrence_billing_mode
        : null,
  }));
  const dimensions = dimensionsRes.data ?? [];
  const dimensionValues = dimensionValuesRes.data ?? [];
  const allServicePrices = servicePricesRes.data ?? [];
  const doctors = doctorsRes.data ?? [];

  const servicePrices =
    profile.role === "medico"
      ? allServicePrices.filter((p) => p.professional_id === user.id)
      : allServicePrices;

  const priceIds = servicePrices.map((p) => p.id);
  let priceRuleDimensionValues: { service_price_id: string; dimension_value_id: string }[] = [];
  if (priceIds.length > 0) {
    const prdvRes = await supabase
      .from("price_rule_dimension_values")
      .select("service_price_id, dimension_value_id")
      .in("service_price_id", priceIds);
    priceRuleDimensionValues = prdvRes.data ?? [];
  }

  const dimensionValuesByPrice: Record<string, string[]> = {};
  for (const row of priceRuleDimensionValues) {
    if (!dimensionValuesByPrice[row.service_price_id]) dimensionValuesByPrice[row.service_price_id] = [];
    dimensionValuesByPrice[row.service_price_id].push(row.dimension_value_id);
  }

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

  const doctorIdsByProcedureId: Record<string, string[]> = {};
  for (const row of doctorProceduresRes.data ?? []) {
    if (!doctorIdsByProcedureId[row.procedure_id]) {
      doctorIdsByProcedureId[row.procedure_id] = [];
    }
    doctorIdsByProcedureId[row.procedure_id].push(row.doctor_id);
  }

  const products = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
  }));

  const fichaRes = isAdmin ? await listClinicalFichaTemplates() : { data: [] };
  const initialMainTab = params.tab === "procedimentos" ? "procedimentos" as const : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Serviços e Valores</h1>
        <p className="text-muted-foreground max-w-2xl">
          {isAdmin
            ? "Cadastre procedimentos clínicos e configure serviços, dimensões de preço (convênio, cidade, turno, campanha) e regras de valor. Na agenda, o Secretário(a) escolhe procedimento, serviço e dimensões para definir o preço da consulta de forma padronizada."
            : "Configure serviços, dimensões de preço (convênio, cidade, turno, campanha) e regras de valor. Na agenda, o Secretário(a) escolhe serviço e dimensões para definir o preço da consulta de forma padronizada."}
        </p>
      </header>
      <ServicosValoresClient
        services={services}
        dimensions={dimensions}
        dimensionValues={dimensionValues}
        servicePrices={servicePrices}
        dimensionValueIdsByPriceId={dimensionValuesByPrice}
        doctors={doctors}
        currentUserId={user.id}
        currentUserRole={profile.role}
        showProcedimentosTab={isAdmin}
        initialMainTab={initialMainTab}
        procedures={procedures}
        appointmentTypes={appointmentTypes}
        doctorIdsByProcedureId={doctorIdsByProcedureId}
        products={products}
        fichaTemplates={fichaRes.data ?? []}
      />
    </div>
  );
}
