import type { KnowledgeAcl } from "../knowledge-acl";
import type { FieldSpec, InformationSource, SourceLoadContext, StructuredSlice } from "./types";

export const servicesSource: InformationSource = {
  id: "services",
  displayName: "Serviços",
  editHref: "/dashboard/servicos-valores",
  fields: (): FieldSpec[] => [
    { id: "list", label: "Listar serviços", aclKey: "list" },
    { id: "explainDifferences", label: "Explicar diferenças", aclKey: "explainDifferences" },
    { id: "showPrices", label: "Mostrar preços", aclKey: "showPrices" },
    {
      id: "showDimensionVariants",
      label: "Variações por dimensão",
      aclKey: "showDimensionVariants",
    },
  ],
  async load(ctx: SourceLoadContext) {
    const [{ data: services }, { data: prices }] = await Promise.all([
      ctx.supabase.from("services").select("id, nome, categoria").eq("clinic_id", ctx.clinicId).order("nome"),
      ctx.supabase
        .from("service_prices")
        .select("id, service_id, valor, professional_id")
        .eq("clinic_id", ctx.clinicId)
        .eq("ativo", true),
    ]);
    return { services: services ?? [], prices: prices ?? [] };
  },
  buildContext(data, acl): StructuredSlice | null {
    if (!acl.services.enabled || !acl.services.fields.list) return null;
    const f = acl.services.fields;
    const raw = data as {
      services: { id: string; nome: string; categoria: string | null }[];
      prices: { service_id: string; valor: number }[];
    };
    const byService = new Map<string, number[]>();
    if (f.showPrices) {
      for (const p of raw.prices) {
        const list = byService.get(p.service_id) ?? [];
        list.push(Number(p.valor));
        byService.set(p.service_id, list);
      }
    }
    const items = raw.services.map((s) => {
      const item: Record<string, unknown> = {
        id: s.id,
        name: s.nome,
        category: s.categoria,
      };
      if (f.showPrices) {
        const vals = byService.get(s.id);
        if (vals?.length) {
          item.priceMin = Math.min(...vals);
          item.priceMax = Math.max(...vals);
        } else {
          item.priceNote = "consultar";
        }
      }
      return item;
    });
    return {
      items,
      showDimensionVariants: f.showDimensionVariants,
      explainDifferences: f.explainDifferences,
    };
  },
};
