import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export function suggestDurationMinutesFromProcedures(
  procedureIds: string[],
  procedures: { id: string; duration_minutes?: number | null }[]
): number {
  if (!procedureIds.length) return 30;
  const selected = procedures.filter((p) => procedureIds.includes(p.id));
  if (!selected.length) return 30;
  return Math.max(...selected.map((p) => p.duration_minutes ?? 30));
}

/** Procedimento padrão de retorno (nome "Retorno", case-insensitive). */
export async function findRetornoProcedureForClinic(
  supabase: Db,
  clinicId: string
): Promise<{ id: string; default_service_id: string | null; duration_minutes: number } | null> {
  const { data } = await supabase
    .from("procedures")
    .select("id, default_service_id, duration_minutes, name")
    .eq("clinic_id", clinicId);

  const match = (data ?? []).find(
    (p) => String(p.name ?? "").trim().toLowerCase() === "retorno"
  );
  if (!match) return null;
  return {
    id: String(match.id),
    default_service_id: match.default_service_id ? String(match.default_service_id) : null,
    duration_minutes: Number(match.duration_minutes) || 30,
  };
}

/** Rótulo de tipo/atendimento para exibição e mensagens (serviço → procedimento → tipo legado). */
export function resolveAppointmentTipoLabel(opts: {
  serviceName?: string | null;
  procedureName?: string | null;
  legacyTypeName?: string | null;
}): string | null {
  return opts.serviceName?.trim() || opts.procedureName?.trim() || opts.legacyTypeName?.trim() || null;
}
