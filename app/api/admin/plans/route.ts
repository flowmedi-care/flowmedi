import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSystemAdmin } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSystemAdmin(false);
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("plans")
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        max_doctors: body.max_doctors ?? null,
        max_secretaries: body.max_secretaries ?? null,
        max_appointments_per_month: body.max_appointments_per_month ?? null,
        max_patients: body.max_patients ?? null,
        max_form_templates: body.max_form_templates ?? null,
        max_custom_fields: body.max_custom_fields ?? null,
        storage_mb: body.storage_mb ?? null,
        whatsapp_enabled: body.whatsapp_enabled ?? false,
        email_enabled: body.email_enabled ?? false,
        custom_logo_enabled: body.custom_logo_enabled ?? false,
        priority_support: body.priority_support ?? false,
        stripe_price_id: body.stripe_price_id || null,
        is_active: body.is_active ?? true,
        price_display: body.price_display || null,
        features: Array.isArray(body.features) ? body.features : null,
        sort_order: body.sort_order ?? 0,
        show_on_pricing: body.show_on_pricing ?? false,
        highlighted: body.highlighted ?? false,
        cta_text: body.cta_text || null,
        cta_href: body.cta_href || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar plano" },
      { status: 500 }
    );
  }
}
