import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";
import {
  pickAccessTokenFromCredentials,
  pickWabaIdFromMetadata,
  unsubscribeWhatsappWabaApp,
} from "@/lib/whatsapp/unsubscribe-waba-app";

/**
 * Desconecta a integração do WhatsApp/Meta com reset completo.
 * POST /api/integrations/whatsapp/disconnect
 */
export async function POST() {
  try {
    const admin = await requireClinicAdminApi();
    const supabase = await createClient();
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }

    // 0) Ler credenciais atuais para unsubscribe na Meta antes de limpar o local.
    const { data: currentRows } = await supabase
      .from("clinic_integrations")
      .select("integration_type, metadata, credentials")
      .eq("clinic_id", admin.clinicId)
      .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
      .eq("status", "connected");

    const unsubscribeWarnings: string[] = [];
    const seenWabas = new Set<string>();
    for (const row of currentRows ?? []) {
      const wabaId = pickWabaIdFromMetadata(
        (row.metadata as Record<string, unknown> | null) ?? null
      );
      const accessToken = pickAccessTokenFromCredentials(
        (row.credentials as Record<string, unknown> | null) ?? null
      );
      if (wabaId && seenWabas.has(wabaId)) continue;
      if (wabaId) seenWabas.add(wabaId);

      const unsub = await unsubscribeWhatsappWabaApp({ wabaId, accessToken });
      if (unsub.warning) unsubscribeWarnings.push(unsub.warning);
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
        error_message: unsubscribeWarnings[0] ?? null,
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

    return NextResponse.json({
      success: true,
      reset: true,
      unsubscribe_warning: unsubscribeWarnings[0] ?? null,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return toApiErrorResponse(error);
    }
    console.error("Erro ao desconectar WhatsApp:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desconectar" },
      { status: 500 }
    );
  }
}
