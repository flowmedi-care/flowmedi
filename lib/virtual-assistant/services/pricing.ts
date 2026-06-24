import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveServicePriceForClinic(
  supabase: SupabaseClient,
  clinicId: string,
  serviceId: string,
  professionalId: string,
  dimensionValueIds: string[]
): Promise<{ valor: number | null; error: string | null; needsDimensions?: boolean }> {
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
    const { data: dims } = await supabase
      .from("price_dimensions")
      .select("id, nome, dimension_values(id, valor)")
      .eq("clinic_id", clinicId)
      .eq("ativo", true);
    const dimNames = (dims ?? []).map((d) => d.nome).join(", ");
    return {
      valor: null,
      error: null,
      needsDimensions: true,
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
    return { valor: null, error: null, needsDimensions: true };
  }

  return { valor: best?.valor ?? null, error: null };
}

export async function getProcedureInfo(
  supabase: SupabaseClient,
  clinicId: string,
  procedureId: string
) {
  const { data } = await supabase
    .from("procedures")
    .select("id, name, duration_minutes, recommendations, default_service_id")
    .eq("id", procedureId)
    .eq("clinic_id", clinicId)
    .single();
  return data;
}
