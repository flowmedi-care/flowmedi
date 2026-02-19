import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Registra número WhatsApp com PIN
 * POST /api/integrations/whatsapp-simple/register
 * Body: { pin: string }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const body = await request.json();
    const pin = typeof body.pin === "string" ? body.pin.trim() : null;

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN deve ter 6 dígitos" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Buscar integração
    const { data: integration, error: fetchError } = await supabase
      .from("clinic_integrations")
      .select("credentials, metadata")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple")
      .eq("status", "connected")
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integração WhatsApp Simple não encontrada ou não conectada" },
        { status: 404 }
      );
    }

    const credentials = integration.credentials as { access_token?: string };
    const metadata = integration.metadata as { phone_number_id?: string };

    if (!credentials.access_token) {
      return NextResponse.json(
        { error: "Token de acesso não encontrado" },
        { status: 400 }
      );
    }

    if (!metadata.phone_number_id) {
      return NextResponse.json(
        { error: "Phone Number ID não configurado" },
        { status: 400 }
      );
    }

    // Chamar API de registro da Meta
    const registerUrl = `https://graph.facebook.com/v21.0/${metadata.phone_number_id}/register`;
    const registerResponse = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: pin,
      }),
    });

    const registerData = await registerResponse.json();

    if (!registerResponse.ok) {
      return NextResponse.json(
        {
          error: registerData.error?.message || "Erro ao registrar número",
          debug: registerData,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Número registrado com sucesso",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar número" },
      { status: 500 }
    );
  }
}
