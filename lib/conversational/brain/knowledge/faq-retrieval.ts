import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicConfig } from "../../clinic/clinic-config";
import type { InfoNeed } from "../types/understanding";
import type { TurnPlan } from "../types/turn-plan";
import type { TurnContext } from "../types/turn-context";
import { infoNeedToChain } from "../planning/plan-templates";
import { semanticFaqSearch, semanticFaqSearchWithEmbeddings } from "./semantic-faq";

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  question_embedding?: number[] | null;
};

/** Enriquece plano com steps de fallback se o plano original tem poucas tools. */
export async function enrichPlanWithFallbacks(
  plan: TurnPlan,
  ctx: TurnContext,
  infoNeeds: InfoNeed[]
): Promise<TurnPlan> {
  if (plan.toolSteps.length > 0 || plan.clarify || plan.handoff) {
    return plan;
  }

  const chain = infoNeeds.flatMap((n) => infoNeedToChain(n));
  const unique = [...new Set(chain)];
  const toolSteps: TurnPlan["toolSteps"] = [];

  for (const source of unique.slice(0, 3)) {
    const tool = mapChainSourceToTool(source);
    if (!tool) continue;
    toolSteps.push({
      id: `e${toolSteps.length}`,
      tool,
      args: tool === "searchFaq" ? { query: ctx.message } : {},
      parallelizable: true,
      purpose: `Enrich: ${source}`,
    });
  }

  return {
    ...plan,
    toolSteps,
    confidence: Math.max(plan.confidence, 0.75),
    source: plan.source,
  };
}

function mapChainSourceToTool(
  source: string
): TurnPlan["toolSteps"][number]["tool"] | null {
  switch (source) {
    case "listServices":
      return "listServices";
    case "list_procedures":
      return "list_procedures";
    case "searchFaq":
      return "searchFaq";
    case "getPriceQuote":
      return "getPriceQuote";
    case "find_available_slots":
      return "find_available_slots";
    case "list_price_options":
      return "getPriceQuote";
    case "clinic_settings":
      return "searchFaq";
    case "list_doctors":
      return "find_available_slots";
    default:
      return null;
  }
}

export async function searchFaqWithFallback(
  query: string,
  faqs: ClinicConfig["faqs"],
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
  fallback: ClinicConfig["faqs"]
): Promise<FaqRow[]> {
  const { data, error } = await supabase
    .from("clinic_virtual_assistant_faq")
    .select("id, question, answer, question_embedding")
    .eq("clinic_id", clinicId)
    .order("display_order");

  if (error || !data?.length) {
    return fallback;
  }

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
