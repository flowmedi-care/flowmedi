import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAppointmentProcedures } from "@/lib/appointment-procedures";

export async function resolveFichaTemplateIdsForAppointment(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  legacyProcedure?: unknown
): Promise<{ id: string; sort_order: number }[]> {
  const procedures = await loadAppointmentProcedures(supabase, appointmentId, legacyProcedure as never);
  const procedureIds = procedures.map((p) => p.id);

  if (procedureIds.length > 0) {
    const { data: links, error } = await supabase
      .from("procedure_clinical_fichas")
      .select("ficha_template_id, sort_order, clinical_ficha_templates!inner(active, clinic_id)")
      .in("procedure_id", procedureIds);

    if (!error && links && links.length > 0) {
      const byFicha = new Map<string, number>();
      for (const row of links) {
        const tpl = Array.isArray(row.clinical_ficha_templates)
          ? row.clinical_ficha_templates[0]
          : row.clinical_ficha_templates;
        if (!(tpl as { active?: boolean })?.active) continue;
        if ((tpl as { clinic_id?: string })?.clinic_id !== clinicId) continue;
        const fid = String(row.ficha_template_id);
        const order = Number(row.sort_order);
        if (!byFicha.has(fid) || order < byFicha.get(fid)!) {
          byFicha.set(fid, order);
        }
      }
      return Array.from(byFicha.entries())
        .map(([id, sort_order]) => ({ id, sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order);
    }
  }

  const { data: fallback } = await supabase
    .from("clinical_ficha_templates")
    .select("id, display_order")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("display_order");

  return (fallback ?? []).map((f) => ({ id: String(f.id), sort_order: Number(f.display_order) }));
}

export async function provisionAppointmentFichas(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  legacyProcedure?: unknown,
  filledBy?: string | null
): Promise<{ error: string | null }> {
  const templateRefs = await resolveFichaTemplateIdsForAppointment(
    supabase,
    clinicId,
    appointmentId,
    legacyProcedure
  );
  if (templateRefs.length === 0) return { error: null };

  const { data: existing } = await supabase
    .from("appointment_ficha_instances")
    .select("ficha_template_id")
    .eq("appointment_id", appointmentId);

  const existingIds = new Set((existing ?? []).map((e) => String(e.ficha_template_id)));
  const toInsert = templateRefs
    .filter((t) => !existingIds.has(t.id))
    .map((t) => ({
      appointment_id: appointmentId,
      ficha_template_id: t.id,
      responses: {},
      status: "rascunho" as const,
      filled_by: filledBy ?? null,
    }));

  if (toInsert.length === 0) return { error: null };

  const { error } = await supabase.from("appointment_ficha_instances").insert(toInsert);
  if (error?.message?.includes("does not exist")) {
    return { error: null };
  }
  return { error: error?.message ?? null };
}
