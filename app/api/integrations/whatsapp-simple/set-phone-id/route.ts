import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";
import {
  assertWhatsappPhoneNumberIdAvailable,
  isUniquePhoneConstraintError,
} from "@/lib/whatsapp/assert-phone-number-available";

/**
 * Atualiza o Phone Number ID manualmente para WhatsApp Simple
 * POST /api/integrations/whatsapp-simple/set-phone-id
 * Body: { phone_number_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdminApi();
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }
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

    const phoneConflict = await assertWhatsappPhoneNumberIdAvailable(
      supabase,
      phoneNumberId,
      admin.clinicId
    );
    if (phoneConflict) {
      return NextResponse.json({ error: phoneConflict }, { status: 409 });
    }

    const { data: integration, error: fetchError } = await supabase
      .from("clinic_integrations")
      .select("metadata")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple")
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integração WhatsApp Simple não encontrada. Conecte primeiro." },
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
      .eq("integration_type", "whatsapp_simple");

    if (updateError) {
      if (isUniquePhoneConstraintError(updateError.message)) {
        return NextResponse.json(
          { error: "Este número WhatsApp já está conectado em outra clínica." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return toApiErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar" },
      { status: 500 }
    );
  }
}
