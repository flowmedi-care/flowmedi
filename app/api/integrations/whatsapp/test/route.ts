import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";
import { createClient } from "@/lib/supabase/server";

/**
 * Envia uma mensagem de teste via WhatsApp (usa template hello_world para poder iniciar conversa)
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

    console.log("[WhatsApp Test] Enviando para:", digitsOnly, "clinicId:", admin.clinicId);

    const supabase = await createClient();
    // Usar template hello_world (como no painel da Meta) — permite iniciar conversa sem 24h
    const result = await sendWhatsAppMessage(admin.clinicId, {
      to: digitsOnly,
      template: "hello_world",
    }, true, supabase);

    console.log("[WhatsApp Test] Resultado:", { success: result.success, error: result.error, debug: result.debug });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Erro ao enviar mensagem",
          debug: result.debug ?? undefined,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      debug: result.debug ?? undefined,
    });
  } catch (error) {
    console.error("[WhatsApp Test] Exceção:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao enviar teste",
        debug: { status: 0, metaResponse: String(error) },
      },
      { status: 500 }
    );
  }
}
