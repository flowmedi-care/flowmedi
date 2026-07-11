import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaygroundCatalog = {
  doctors: Array<{ id: string; full_name: string; specialty?: string | null }>;
  procedures: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    doctor_ids: string[];
  }>;
  rooms: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  pricingDimensions: Array<{ id: string; name: string }>;
  pricingDimensionValues: Array<{
    id: string;
    dimension_id: string;
    name: string;
  }>;
  doctorProcedures: Array<{ doctor_id: string; procedure_id: string }>;
};

export async function loadPlaygroundCatalog(
  supabase: SupabaseClient,
  clinicId: string
): Promise<PlaygroundCatalog> {
  const [
    { data: doctorsRaw },
    { data: roomsRaw },
    { data: procedures },
    { data: services },
    { data: pricingDimensions },
    { data: pricingDimensionValuesRaw },
    { data: doctorProcedures },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, specialty")
      .eq("clinic_id", clinicId)
      .eq("role", "medico")
      .order("full_name"),
    supabase
      .from("rooms")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("procedures")
      .select("id, name, duration_minutes")
      .eq("clinic_id", clinicId)
      .order("display_order", { ascending: true }),
    supabase.from("services").select("id, nome").eq("clinic_id", clinicId).order("nome"),
    supabase
      .from("price_dimensions")
      .select("id, nome")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("dimension_values")
      .select("id, dimension_id, nome")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("doctor_procedures")
      .select("doctor_id, procedure_id")
      .eq("clinic_id", clinicId),
  ]);

  const dpList = doctorProcedures ?? [];
  const procedureDoctorMap = new Map<string, string[]>();
  for (const row of dpList) {
    const list = procedureDoctorMap.get(row.procedure_id) ?? [];
    list.push(row.doctor_id);
    procedureDoctorMap.set(row.procedure_id, list);
  }

  return {
    doctors: (doctorsRaw ?? []).map((d) => ({
      id: d.id,
      full_name: d.full_name ?? "Sem nome",
      specialty: d.specialty ?? null,
    })),
    procedures: (procedures ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      duration_minutes: p.duration_minutes ?? 30,
      doctor_ids: procedureDoctorMap.get(p.id) ?? [],
    })),
    rooms: (roomsRaw ?? []).map((r) => ({ id: r.id, name: r.name })),
    services: (services ?? []).map((s) => ({ id: s.id, name: s.nome })),
    pricingDimensions: (pricingDimensions ?? []).map((d) => ({
      id: d.id,
      name: d.nome,
    })),
    pricingDimensionValues: (pricingDimensionValuesRaw ?? []).map((v) => ({
      id: v.id,
      dimension_id: v.dimension_id,
      name: v.nome,
    })),
    doctorProcedures: dpList.map((r) => ({
      doctor_id: r.doctor_id,
      procedure_id: r.procedure_id,
    })),
  };
}
