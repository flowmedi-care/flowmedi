import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Registra o número no WhatsApp Cloud API (resolve "accepted" mas não entregue).
 * POST /api/integrations/whatsapp-simple/register
 * Body: { "pin": "123456" } — ou usa META_WHATSAPP_REGISTER_PIN se não enviar
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();

    const { data: integration } = await supabase
      .from("clinic_integrations")
      .select("credentials, metadata")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple")
      .eq("status", "connected")
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: "Integração WhatsApp Simples não encontrada ou não conectada" },
        { status: 400 }
      );
    }

    const credentials = integration.credentials as { access_token?: string };
    const metadata = integration.metadata as { phone_number_id?: string };
    const accessToken = credentials?.access_token;
    const phoneNumberId = metadata?.phone_number_id;

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: "Token ou Phone Number ID não encontrado. Reconecte a integração." },
        { status: 400 }
      );
    }

    let pin: string | null = null;
    try {
      const body = await request.json();
      pin = body?.pin?.trim() || null;
    } catch {
      // body vazio ou inválido
    }
    if (!pin) {
      pin = process.env.META_WHATSAPP_REGISTER_PIN?.trim() || null;
    }
    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "Envie um PIN de 6 dígitos no body: { \"pin\": \"123456\" } ou defina META_WHATSAPP_REGISTER_PIN" },
        { status: 400 }
      );
    }

    const registerUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/register`;
    const res = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[WhatsApp Simple Register] Meta error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Erro ao registrar número", meta: data },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Número registrado. Tente enviar mensagens novamente.",
    });
  } catch (error) {
    console.error("Erro ao registrar número WhatsApp:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar" },
      { status: 500 }
    );
  }
}
