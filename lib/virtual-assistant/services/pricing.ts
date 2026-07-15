import type { SupabaseClient } from "@supabase/supabase-js";

export interface PriceDimensionOption {
  id: string;
  nome: string;
  values: { id: string; valor: string }[];
}

export interface ServicePriceResult {
  valor: number | null;
  error: string | null;
  needsDimensions?: boolean;
  dimensions?: PriceDimensionOption[];
}

async function loadActiveDimensions(
  supabase: SupabaseClient,
  clinicId: string
): Promise<PriceDimensionOption[]> {
  const { data: dims } = await supabase
    .from("price_dimensions")
    .select("id, nome, dimension_values(id, valor, ativo)")
    .eq("clinic_id", clinicId)
    .eq("ativo", true)
    .order("nome");

  return (dims ?? [])
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      values: (
        (d.dimension_values as { id: string; valor: string; ativo: boolean }[] | null) ?? []
      )
        .filter((v) => v.ativo !== false)
        .map((v) => ({ id: v.id, valor: v.valor })),
    }))
    .filter((d) => d.values.length > 0);
}

export async function resolveServicePriceForClinic(
  supabase: SupabaseClient,
  clinicId: string,
  serviceId: string,
  professionalId: string,
  dimensionValueIds: string[]
): Promise<ServicePriceResult> {
  const { data: rules } = await supabase
    .from("service_prices")
    .select("id, valor, professional_id")
    .eq("clinic_id", clinicId)
    .eq("service_id", serviceId)
    .eq("ativo", true)
    .or(`professional_id.is.null,professional_id.eq.${professionalId}`);

  if (!rules?.length) return { valor: null, error: null };

  const ruleIds = rules.map((r) => r.id);
  const { data: prdv } = await supabase
    .from("price_rule_dimension_values")
    .select("service_price_id, dimension_value_id")
    .in("service_price_id", ruleIds);

  const ruleDimensionSets: Record<string, Set<string>> = {};
  for (const r of rules) ruleDimensionSets[r.id] = new Set();
  for (const row of prdv ?? []) {
    if (ruleDimensionSets[row.service_price_id]) {
      ruleDimensionSets[row.service_price_id].add(row.dimension_value_id);
    }
  }

  const hasDimensionRules = (prdv ?? []).length > 0;
  if (hasDimensionRules && dimensionValueIds.length === 0) {
    const dimensions = await loadActiveDimensions(supabase, clinicId);
    return {
      valor: null,
      error: null,
      needsDimensions: true,
      dimensions,
    };
  }

  const selectedSet = new Set(dimensionValueIds);
  let best: { valor: number; size: number; isProfessionalSpecific: boolean } | null = null;

  for (const r of rules) {
    const ruleSet = ruleDimensionSets[r.id];
    if (!ruleSet) continue;
    const isSubset = [...ruleSet].every((id) => selectedSet.has(id));
    if (!isSubset) continue;
    const isProfessionalSpecific = r.professional_id != null && r.professional_id === professionalId;
    const candidate = {
      valor: Number(r.valor),
      size: ruleSet.size,
      isProfessionalSpecific,
    };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.size > best.size) best = candidate;
    else if (candidate.size === best.size && isProfessionalSpecific && !best.isProfessionalSpecific) {
      best = candidate;
    }
  }

  if (!best && hasDimensionRules) {
    const dimensions = await loadActiveDimensions(supabase, clinicId);
    return {
      valor: null,
      error: null,
      needsDimensions: true,
      dimensions,
    };
  }

  return { valor: best?.valor ?? null, error: null };
}

export async function listPriceOptionsForClinic(
  supabase: SupabaseClient,
  clinicId: string,
  opts: {
    serviceId?: string | null;
    procedureId?: string | null;
    doctorId?: string | null;
  }
): Promise<{
  service_id: string | null;
  service_name: string | null;
  procedure_name: string | null;
  dimensions: PriceDimensionOption[];
  price_range: string | null;
  fixed_price: number | null;
  needs_dimensions: boolean;
  error?: string;
}> {
  let serviceId = opts.serviceId ?? null;
  let procedureName: string | null = null;

  if (!serviceId && opts.procedureId) {
    const { data: proc } = await supabase
      .from("procedures")
      .select("name, default_service_id")
      .eq("id", opts.procedureId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!proc) {
      return {
        service_id: null,
        service_name: null,
        procedure_name: null,
        dimensions: [],
        price_range: null,
        fixed_price: null,
        needs_dimensions: false,
        error: "Procedimento não encontrado.",
      };
    }
    procedureName = proc.name;
    serviceId = proc.default_service_id;
  }

  if (!serviceId) {
    return {
      service_id: null,
      service_name: null,
      procedure_name: procedureName,
      dimensions: [],
      price_range: null,
      fixed_price: null,
      needs_dimensions: false,
      error: "Este procedimento não tem serviço de preço configurado.",
    };
  }

  const { data: svc } = await supabase
    .from("services")
    .select("nome")
    .eq("id", serviceId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const doctorId = opts.doctorId ?? "";
  const dimensions = await loadActiveDimensions(supabase, clinicId);

  const { data: prices } = await supabase
    .from("service_prices")
    .select("valor, professional_id")
    .eq("clinic_id", clinicId)
    .eq("service_id", serviceId)
    .eq("ativo", true);

  const applicable = (prices ?? []).filter(
    (p) => !p.professional_id || (doctorId && p.professional_id === doctorId)
  );
  const vals = applicable.map((p) => Number(p.valor));
  const priceRange = vals.length ? formatPriceRange(vals) : null;

  const priceResult = await resolveServicePriceForClinic(
    supabase,
    clinicId,
    serviceId,
    doctorId,
    []
  );

  return {
    service_id: serviceId,
    service_name: svc?.nome ?? null,
    procedure_name: procedureName,
    dimensions: priceResult.dimensions ?? dimensions,
    price_range: priceRange,
    fixed_price: priceResult.valor,
    needs_dimensions: Boolean(priceResult.needsDimensions),
  };
}

function formatPriceRange(vals: number[]): string {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return `R$ ${min.toFixed(2)}`;
  return `de R$ ${min.toFixed(2)} a R$ ${max.toFixed(2)}`;
}

export async function getProcedureInfo(
  supabase: SupabaseClient,
  clinicId: string,
  procedureId: string
) {
  const { data } = await supabase
    .from("procedures")
    .select(
      "id, name, duration_minutes, recommendations, short_description, how_we_perform, recovery, default_service_id"
    )
    .eq("id", procedureId)
    .eq("clinic_id", clinicId)
    .single();
  return data;
}

export async function listServicesForClinic(
  supabase: SupabaseClient,
  clinicId: string
): Promise<
  {
    id: string;
    nome: string;
    categoria: string | null;
    procedures: string[];
    price_range: string | null;
  }[]
> {
  const [{ data: services }, { data: procedures }, { data: prices }] = await Promise.all([
    supabase.from("services").select("id, nome, categoria").eq("clinic_id", clinicId).order("nome"),
    supabase.from("procedures").select("id, name, default_service_id").eq("clinic_id", clinicId),
    supabase
      .from("service_prices")
      .select("service_id, valor")
      .eq("clinic_id", clinicId)
      .eq("ativo", true),
  ]);

  const pricesByService = new Map<string, number[]>();
  for (const p of prices ?? []) {
    const list = pricesByService.get(p.service_id) ?? [];
    list.push(Number(p.valor));
    pricesByService.set(p.service_id, list);
  }

  const procsByService = new Map<string, string[]>();
  for (const proc of procedures ?? []) {
    if (!proc.default_service_id) continue;
    const list = procsByService.get(proc.default_service_id) ?? [];
    list.push(proc.name);
    procsByService.set(proc.default_service_id, list);
  }

  return (services ?? []).map((svc) => {
    const vals = pricesByService.get(svc.id);
    return {
      id: svc.id,
      nome: svc.nome,
      categoria: svc.categoria,
      procedures: procsByService.get(svc.id) ?? [],
      price_range: vals?.length ? formatPriceRange(vals) : null,
    };
  });
}
