import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/plans/pricing
 * Retorna planos configurados para exibição na página de preços.
 * Público (sem autenticação) - usado por /precos.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, slug, description, price_display, features, highlighted, cta_text, cta_href, stripe_price_id")
    .eq("show_on_pricing", true)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  }

  return NextResponse.json(
    { plans: plans ?? [] },
    {
      headers: {
        // Cache alto para reduzir chamadas repetidas da página /precos.
        // 12h em CDN + 24h stale enquanto revalida.
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400",
      },
    }
  );
}
