import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/plans/pricing
 * Retorna planos configurados para exibição na página de preços.
 * Público (sem autenticação) - usado por /precos.
 */
export async function GET() {
  const supabase = await createClient();

  const fullSelect =
    "id, name, slug, description, price_display, price_display_annual, features, highlighted, cta_text, cta_href, stripe_price_id, stripe_price_id_monthly, stripe_price_id_annually";
  const legacySelect =
    "id, name, slug, description, price_display, features, highlighted, cta_text, cta_href, stripe_price_id";

  let plans: Array<Record<string, unknown>> | null = null;
  let errorMessage: string | null = null;

  const primary = await supabase
    .from("plans")
    .select(fullSelect)
    .eq("show_on_pricing", true)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (primary.error) {
    // Colunas anuais ainda não migradas — fallback legado
    const fallback = await supabase
      .from("plans")
      .select(legacySelect)
      .eq("show_on_pricing", true)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (fallback.error) {
      errorMessage = fallback.error.message;
    } else {
      plans = (fallback.data as Array<Record<string, unknown>>) ?? [];
    }
  } else {
    plans = (primary.data as Array<Record<string, unknown>>) ?? [];
  }

  if (errorMessage) {
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  }

  const publicPlans = (plans ?? []).map((p) => {
    const monthlyId =
      (p.stripe_price_id_monthly as string | null | undefined) ||
      (p.stripe_price_id as string | null | undefined);
    const annualId = p.stripe_price_id_annually as string | null | undefined;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price_display: p.price_display,
      price_display_annual: p.price_display_annual ?? null,
      features: p.features,
      highlighted: p.highlighted,
      cta_text: p.cta_text,
      cta_href: p.cta_href,
      stripe_price_id: monthlyId ? "configured" : null,
      has_annual_price: Boolean(annualId),
    };
  });

  return NextResponse.json(
    { plans: publicPlans },
    {
      headers: {
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400",
      },
    }
  );
}
