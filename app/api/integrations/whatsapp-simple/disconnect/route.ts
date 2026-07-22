import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";
import {
  pickAccessTokenFromCredentials,
  pickWabaIdFromMetadata,
  unsubscribeWhatsappWabaApp,
} from "@/lib/whatsapp/unsubscribe-waba-app";

/**
 * Desconecta a integração do WhatsApp Simple
 * POST /api/integrations/whatsapp-simple/disconnect
 */
export async function POST(_request: NextRequest) {
  try {
    const admin = await requireClinicAdminApi();
    const supabase = await createClient();
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }

    const { data: current } = await supabase
      .from("clinic_integrations")
      .select("metadata, credentials")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple")
      .eq("status", "connected")
      .maybeSingle();

    const unsub = await unsubscribeWhatsappWabaApp({
      wabaId: pickWabaIdFromMetadata(
        (current?.metadata as Record<string, unknown> | null) ?? null
      ),
      accessToken: pickAccessTokenFromCredentials(
        (current?.credentials as Record<string, unknown> | null) ?? null
      ),
    });

    const { error } = await supabase
      .from("clinic_integrations")
      .update({
        status: "disconnected",
        credentials: {},
        metadata: {},
        connected_at: null,
        last_sync_at: null,
        error_message: unsub.warning,
      })
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      unsubscribe_warning: unsub.warning,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return toApiErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desconectar" },
      { status: 500 }
    );
  }
}
