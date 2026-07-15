import type { KnowledgeAcl } from "../knowledge-acl";
import type { FieldSpec, InformationSource, SourceLoadContext, StructuredSlice } from "./types";

export const knowledgeBaseSource: InformationSource = {
  id: "knowledge_base",
  displayName: "Base de conhecimento",
  editHref: "/dashboard/configuracoes/base-de-conhecimento",
  fields: (): FieldSpec[] => [],
  async load(ctx: SourceLoadContext) {
    const { data } = await ctx.supabase
      .from("clinic_virtual_assistant_faq")
      .select("id, question, answer, keywords, category, display_order")
      .eq("clinic_id", ctx.clinicId)
      .order("display_order");
    return data ?? [];
  },
  buildContext(data, acl): StructuredSlice | null {
    if (!acl.knowledge_base.enabled) return null;
    const entries = data as {
      question: string;
      answer: string;
      keywords?: string[] | null;
      category?: string | null;
    }[];
    if (!entries.length) return null;
    return {
      entries: entries.map((e) => ({
        question: e.question,
        answer: e.answer,
        keywords: e.keywords ?? [],
        category: e.category ?? null,
      })),
    };
  },
};
