import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ServicosValoresClient } from "./servicos-valores-client";

export default async function ServicosValoresPage() {
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

  const [
    servicesRes,
    dimensionsRes,
    dimensionValuesRes,
    servicePricesRes,
    doctorsRes,
  ] = await Promise.all([
    supabase.from("services").select("id, nome, categoria").eq("clinic_id", clinicId).order("nome"),
    supabase.from("price_dimensions").select("id, nome, ativo").eq("clinic_id", clinicId).order("nome"),
    supabase.from("dimension_values").select("id, dimension_id, nome, ativo").eq("clinic_id", clinicId).order("nome"),
    supabase
      .from("service_prices")
      .select("id, service_id, professional_id, valor, ativo")
      .eq("clinic_id", clinicId),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("role", "medico").order("full_name"),
  ]);

  const services = servicesRes.data ?? [];
  const dimensions = dimensionsRes.data ?? [];
  const dimensionValues = dimensionValuesRes.data ?? [];
  const servicePrices = servicePricesRes.data ?? [];
  const doctors = doctorsRes.data ?? [];

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Serviços e Valores</h1>
      <p className="text-sm text-muted-foreground">
        Cadastre os serviços, dimensões de preço (convênio, cidade, turno, etc.) e as regras de valor. Na agenda, a secretária escolhe serviço e dimensões para definir o preço da consulta.
      </p>
      <ServicosValoresClient
        services={services}
        dimensions={dimensions}
        dimensionValues={dimensionValues}
        servicePrices={servicePrices}
        dimensionValueIdsByPriceId={dimensionValuesByPrice}
        doctors={doctors}
      />
    </div>
  );
}
