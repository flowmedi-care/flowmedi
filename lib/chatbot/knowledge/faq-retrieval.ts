import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaqItem } from "../tools/types";
import { semanticFaqSearch, semanticFaqSearchWithEmbeddings } from "./semantic-faq";

export async function searchFaqWithFallback(
  query: string,
  faqs: FaqItem[],
  supabase?: SupabaseClient,
  clinicId?: string
): Promise<{ id: string; question: string; answer: string } | null> {
  const direct = semanticFaqSearch(query, faqs);
  if (direct) return direct;

  if (supabase && clinicId && process.env.OPENAI_API_KEY) {
    const withEmbeddings = await loadFaqsWithEmbeddings(supabase, clinicId, faqs);
    const embedded = await semanticFaqSearchWithEmbeddings(query, withEmbeddings);
    if (embedded) return embedded;
  }

  return null;
}

async function loadFaqsWithEmbeddings(
  supabase: SupabaseClient,
  clinicId: string,
  fallback: FaqItem[]
) {
  const { data, error } = await supabase
    .from("clinic_virtual_assistant_faq")
    .select("id, question, answer, question_embedding")
    .eq("clinic_id", clinicId)
    .order("display_order");

  if (error || !data?.length) return fallback;

  return data.map((row) => ({
    id: String(row.id),
    question: String(row.question),
    answer: String(row.answer),
    question_embedding: parseEmbedding(row.question_embedding),
  }));
}

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number) : null;
    } catch {
      return null;
    }
  }
  return null;
}
