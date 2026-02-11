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
    const { id } = await params;
    const body = await request.json();

    // Verificar se o plano existe antes de atualizar
    const { data: existingPlan, error: checkError } = await supabase
      .from("plans")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json({ error: `Erro ao verificar plano: ${checkError.message}` }, { status: 400 });
    }

    if (!existingPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    // Função helper para converter string vazia em null
    const parseNumberOrNull = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = typeof value === "string" ? parseInt(value, 10) : value;
      return isNaN(parsed as number) ? null : (parsed as number);
    };

    const parseFloatOrNull = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = typeof value === "string" ? parseFloat(value) : value;
      return isNaN(parsed as number) ? null : (parsed as number);
    };

    // Converter GB para MB (storage_mb no banco é em MB)
    // Se o usuário digitar 0.3 GB, converte para 307 MB (0.3 * 1024 = 307.2 → 307)
    const storageMB = body.storage_mb && body.storage_mb !== "" && body.storage_mb !== "0"
      ? (() => {
          const gbValue = parseFloatOrNull(body.storage_mb);
          if (gbValue === null || gbValue === 0) return null;
          return Math.round(gbValue * 1024);
        })()
      : null;

    const updateData: Record<string, unknown> = {
      name: body.name,
      description: body.description || null,
      max_doctors: parseNumberOrNull(body.max_doctors),
      max_secretaries: parseNumberOrNull(body.max_secretaries),
      max_appointments_per_month: parseNumberOrNull(body.max_appointments_per_month),
      max_patients: parseNumberOrNull(body.max_patients),
      max_form_templates: parseNumberOrNull(body.max_form_templates),
      max_custom_fields: parseNumberOrNull(body.max_custom_fields),
      storage_mb: storageMB,
      whatsapp_enabled: body.whatsapp_enabled ?? false,
      email_enabled: body.email_enabled ?? false,
      custom_logo_enabled: body.custom_logo_enabled ?? false,
      priority_support: body.priority_support ?? false,
      stripe_price_id: body.stripe_price_id || null,
      is_active: body.is_active ?? true,
    };

    // Adicionar updated_at apenas se a coluna existir (após migration)
    // O trigger cuidará disso automaticamente depois da migration
    // Por enquanto, não incluímos para evitar erro

    const { data, error } = await supabase
      .from("plans")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
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
    const { id } = await params;

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
