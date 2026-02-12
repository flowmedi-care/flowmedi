import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Atualiza o Phone Number ID manualmente (quando a descoberta automática falha)
 * POST /api/integrations/whatsapp/set-phone-id
 * Body: { phone_number_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const body = await request.json();
    const phoneNumberId = typeof body.phone_number_id === "string"
      ? body.phone_number_id.trim()
      : null;

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: "phone_number_id é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Buscar integração atual para preservar o resto do metadata
    const { data: integration, error: fetchError } = await supabase
      .from("clinic_integrations")
      .select("metadata")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_meta")
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integração WhatsApp não encontrada. Conecte primeiro." },
        { status: 404 }
      );
    }

    const currentMetadata = (integration.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...currentMetadata,
      phone_number_id: phoneNumberId,
    };

    const { error: updateError } = await supabase
      .from("clinic_integrations")
      .update({
        metadata: updatedMetadata,
        last_sync_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_meta");

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao definir Phone Number ID:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar" },
      { status: 500 }
    );
  }
}
