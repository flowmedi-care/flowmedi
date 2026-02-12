import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";

/**
 * Envia uma mensagem de teste via WhatsApp
 * POST /api/integrations/whatsapp/test
 * Body: { to: string } — número com DDI, ex: 5562999999999
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const body = await request.json();
    const to = typeof body.to === "string" ? body.to.trim() : "";

    if (!to) {
      return NextResponse.json(
        { error: "Informe o número (ex: 5562999999999)" },
        { status: 400 }
      );
    }

    const digitsOnly = to.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      return NextResponse.json(
        { error: "Número inválido. Use DDI + DDD + número (ex: 5562999999999)" },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(admin.clinicId, {
      to: digitsOnly,
      text: "✅ Teste FlowMedi — Sua integração WhatsApp está funcionando!",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao enviar mensagem" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Erro ao enviar teste WhatsApp:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar teste" },
      { status: 500 }
    );
  }
}
