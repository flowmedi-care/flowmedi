import type { SupabaseClient } from "@supabase/supabase-js";

export type AppointmentProcedureRef = { id: string; name: string };

export type LegacyProcedureRow =
  | { id: string; name: string }
  | { id: string; name: string }[]
  | null
  | undefined;

type LegacyProcedureRowInternal = LegacyProcedureRow;

/** Carrega procedimentos da consulta; tolera ausência de appointment_procedures (migration parcial). */
export async function loadAppointmentProcedures(
  supabase: SupabaseClient,
  appointmentId: string,
  legacyProcedure?: LegacyProcedureRowInternal
): Promise<AppointmentProcedureRef[]> {
  const { data: apProcs, error } = await supabase
    .from("appointment_procedures")
    .select("procedure_id, procedures ( id, name )")
    .eq("appointment_id", appointmentId)
    .order("sort_order");

  if (!error && apProcs && apProcs.length > 0) {
    return apProcs.map((row: Record<string, unknown>) => {
      const pr = Array.isArray(row.procedures) ? row.procedures[0] : row.procedures;
      return {
        id: String((pr as { id: string }).id ?? row.procedure_id),
        name: String((pr as { name: string }).name ?? "Procedimento"),
      };
    });
  }

  if (legacyProcedure) {
    const procRaw = Array.isArray(legacyProcedure) ? legacyProcedure[0] : legacyProcedure;
    if (procRaw?.id) {
      return [{ id: String(procRaw.id), name: String(procRaw.name ?? "Procedimento") }];
    }
  }

  return [];
}

export async function loadServiceName(
  supabase: SupabaseClient,
  serviceId: string | null | undefined
): Promise<string | null> {
  if (!serviceId) return null;
  const { data: svc } = await supabase.from("services").select("nome").eq("id", serviceId).maybeSingle();
  return svc?.nome ?? null;
}
