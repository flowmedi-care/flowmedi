import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";

/**
 * Desconecta a integração do WhatsApp/Meta com reset completo.
 * POST /api/integrations/whatsapp/disconnect
 */
export async function POST() {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }

    // 1) Reset completo das integrações WhatsApp da clínica (meta e legado).
    const { error: resetIntegrationsError } = await supabase
      .from("clinic_integrations")
      .update({
        status: "disconnected",
        credentials: {},
        metadata: {},
        connected_at: null,
        last_sync_at: null,
        error_message: null,
      })
      .eq("clinic_id", admin.clinicId)
      .in("integration_type", ["whatsapp_meta", "whatsapp_simple"]);

    if (resetIntegrationsError) {
      return NextResponse.json(
        { error: resetIntegrationsError.message },
        { status: 400 }
      );
    }

    // 2) Limpa o pareamento/status local dos templates Meta para forçar ressincronização limpa.
    const { error: resetTemplatesError } = await supabase
      .from("clinic_whatsapp_meta_templates")
      .delete()
      .eq("clinic_id", admin.clinicId);

    if (resetTemplatesError) {
      return NextResponse.json(
        { error: resetTemplatesError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, reset: true });
  } catch (error) {
    console.error("Erro ao desconectar WhatsApp:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desconectar" },
      { status: 500 }
    );
  }
}
