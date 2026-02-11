import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSystemAdmin } from "@/lib/auth-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSystemAdmin(false);
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const supabase = await createClient();
    const { id } = await params();
    const body = await request.json();

    const { data, error } = await supabase
      .from("plans")
      .update({
        name: body.name,
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar plano" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSystemAdmin(false);
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const supabase = await createClient();
    const { id } = await params();

    // Verificar se há clínicas usando este plano
    const { count } = await supabase
      .from("clinics")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível deletar: ${count} clínica(s) estão usando este plano` },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("plans").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao deletar plano" },
      { status: 500 }
    );
  }
}
