import type { SupabaseClient } from "@supabase/supabase-js";

export interface DataReadinessIssue {
  level: "error" | "warn";
  message: string;
}

export interface DataReadinessReport {
  ok: boolean;
  issues: DataReadinessIssue[];
  stats: {
    procedures: number;
    proceduresWithoutService: number;
    services: number;
    servicesWithoutPrice: number;
    doctors: number;
    doctorProcedureLinks: number;
    dimensionsWithoutValues: number;
  };
}

export async function gatherDataReadiness(
  supabase: SupabaseClient,
  clinicId: string
): Promise<DataReadinessReport> {
  const issues: DataReadinessIssue[] = [];

  const [
    { data: procedures },
    { data: services },
    { data: prices },
    { data: doctors },
    { data: doctorProcedures },
    { data: dimensions },
  ] = await Promise.all([
    supabase.from("procedures").select("id, name, default_service_id").eq("clinic_id", clinicId),
    supabase.from("services").select("id, nome").eq("clinic_id", clinicId),
    supabase.from("service_prices").select("service_id").eq("clinic_id", clinicId).eq("ativo", true),
    supabase.from("profiles").select("id").eq("clinic_id", clinicId).eq("role", "medico"),
    supabase.from("doctor_procedures").select("id").eq("clinic_id", clinicId),
    supabase
      .from("price_dimensions")
      .select("id, nome, dimension_values(id, ativo)")
      .eq("clinic_id", clinicId)
      .eq("ativo", true),
  ]);

  const procedureList = procedures ?? [];
  const serviceList = services ?? [];
  const pricedServiceIds = new Set((prices ?? []).map((p) => p.service_id));

  const proceduresWithoutService = procedureList.filter((p) => !p.default_service_id);
  for (const p of proceduresWithoutService) {
    issues.push({
      level: "warn",
      message: `Procedimento "${p.name}" sem serviço de preço vinculado (default_service_id).`,
    });
  }

  const servicesWithoutPrice = serviceList.filter((s) => !pricedServiceIds.has(s.id));
  for (const s of servicesWithoutPrice) {
    issues.push({
      level: "warn",
      message: `Serviço "${s.nome}" sem preço cadastrado em service_prices.`,
    });
  }

  let dimensionsWithoutValues = 0;
  for (const dim of dimensions ?? []) {
    const values = (dim.dimension_values as { id: string; ativo: boolean }[] | null) ?? [];
    const active = values.filter((v) => v.ativo !== false);
    if (!active.length) {
      dimensionsWithoutValues++;
      issues.push({
        level: "warn",
        message: `Dimensão de preço "${dim.nome}" sem valores ativos.`,
      });
    }
  }

  if ((doctors ?? []).length > 0 && (doctorProcedures ?? []).length === 0) {
    issues.push({
      level: "warn",
      message: "Nenhum vínculo médico ↔ procedimento (doctor_procedures). O bot não saberá quem faz o quê.",
    });
  }

  if (procedureList.length === 0) {
    issues.push({
      level: "error",
      message: "Nenhum procedimento cadastrado — o bot não pode agendar nem informar serviços.",
    });
  }

  if (serviceList.length === 0) {
    issues.push({
      level: "warn",
      message: "Nenhum serviço cadastrado — preços não estarão disponíveis.",
    });
  }

  return {
    ok: issues.filter((i) => i.level === "error").length === 0,
    issues,
    stats: {
      procedures: procedureList.length,
      proceduresWithoutService: proceduresWithoutService.length,
      services: serviceList.length,
      servicesWithoutPrice: servicesWithoutPrice.length,
      doctors: (doctors ?? []).length,
      doctorProcedureLinks: (doctorProcedures ?? []).length,
      dimensionsWithoutValues,
    },
  };
}
