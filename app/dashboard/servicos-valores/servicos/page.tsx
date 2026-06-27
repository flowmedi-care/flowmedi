import { ServicosValoresClient } from "../servicos-valores-client";
import { requireServicosValoresPageAccess } from "../page-access";
import { listTreatmentPlans } from "@/app/dashboard/agenda/treatment-plan-actions";

export default async function ServicosValoresServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const { supabase, user, profile, clinicId } = await requireServicosValoresPageAccess();

  const [servicesRes, dimensionsRes, dimensionValuesRes, servicePricesRes, doctorsRes] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, nome, categoria, recurrence_billing_mode")
        .eq("clinic_id", clinicId)
        .order("nome"),
      supabase
        .from("price_dimensions")
        .select("id, nome, ativo")
        .eq("clinic_id", clinicId)
        .order("nome"),
      supabase
        .from("dimension_values")
        .select("id, dimension_id, nome, ativo, cor")
        .eq("clinic_id", clinicId)
        .order("nome"),
      supabase
        .from("service_prices")
        .select("id, service_id, professional_id, valor, ativo")
        .eq("clinic_id", clinicId),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("clinic_id", clinicId)
        .eq("role", "medico")
        .order("full_name"),
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
    if (!dimensionValuesByPrice[row.service_price_id]) {
      dimensionValuesByPrice[row.service_price_id] = [];
    }
    dimensionValuesByPrice[row.service_price_id].push(row.dimension_value_id);
  }

  let initialPlans: Awaited<ReturnType<typeof listTreatmentPlans>>["data"] = [];
  if (profile.role === "admin" || profile.role === "secretaria") {
    const plansRes = await listTreatmentPlans();
    initialPlans = plansRes.data ?? [];
  }

  return (
    <ServicosValoresClient
        services={services}
        dimensions={dimensions}
        dimensionValues={dimensionValues}
        servicePrices={servicePrices}
        dimensionValueIdsByPriceId={dimensionValuesByPrice}
        doctors={doctors}
        currentUserId={user.id}
        currentUserRole={profile.role}
        initialPlans={initialPlans}
        initialTab={tab === "planos" ? "planos" : "servicos"}
      />
  );
}
