import type { KnowledgeAcl } from "../knowledge-acl";
import type { FieldSpec, InformationSource, SourceLoadContext, StructuredSlice } from "./types";

type ProcRow = {
  id: string;
  name: string;
  duration_minutes: number | null;
  recommendations: string | null;
  short_description?: string | null;
  how_we_perform?: string | null;
  recovery?: string | null;
  default_service_id: string | null;
};

export const proceduresSource: InformationSource = {
  id: "procedures",
  displayName: "Procedimentos",
  editHref: "/dashboard/servicos-valores/procedimentos",
  fields: (): FieldSpec[] => [
    { id: "list", label: "Listar procedimentos", aclKey: "list" },
    { id: "shortDescription", label: "Descrição curta", aclKey: "shortDescription" },
    { id: "howWePerform", label: "Como realizamos", aclKey: "howWePerform" },
    { id: "prep", label: "Preparo", aclKey: "prep" },
    { id: "duration", label: "Duração", aclKey: "duration" },
    { id: "recovery", label: "Recuperação", aclKey: "recovery" },
    { id: "supplies", label: "Insumos", aclKey: "supplies" },
  ],
  async load(ctx: SourceLoadContext) {
    const full = await ctx.supabase
      .from("procedures")
      .select(
        "id, name, duration_minutes, recommendations, short_description, how_we_perform, recovery, default_service_id"
      )
      .eq("clinic_id", ctx.clinicId)
      .order("display_order");
    if (!full.error) return full.data ?? [];
    // Migration not applied yet — degrade gracefully
    const { data } = await ctx.supabase
      .from("procedures")
      .select("id, name, duration_minutes, recommendations, default_service_id")
      .eq("clinic_id", ctx.clinicId)
      .order("display_order");
    return data ?? [];
  },
  buildContext(data, acl): StructuredSlice | null {
    if (!acl.procedures.enabled || !acl.procedures.fields.list) return null;
    const f = acl.procedures.fields;
    const rows = data as ProcRow[];
    const items = rows.map((p) => {
      const item: Record<string, unknown> = { id: p.id, name: p.name };
      if (f.duration) item.durationMinutes = p.duration_minutes ?? 30;
      if (f.shortDescription && p.short_description) item.shortDescription = p.short_description;
      if (f.howWePerform && p.how_we_perform) item.howWePerform = p.how_we_perform;
      if (f.prep && p.recommendations) item.prep = p.recommendations;
      if (f.recovery && p.recovery) item.recovery = p.recovery;
      if (p.default_service_id) item.defaultServiceId = p.default_service_id;
      return item;
    });
    return { items };
  },
};
