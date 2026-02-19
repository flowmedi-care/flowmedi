import { NextRequest, NextResponse } from "next/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { sendWhatsAppMessage, isWithin24HourWindow } from "@/lib/comunicacao/whatsapp";

/**
 * POST /api/whatsapp/send
 * Body: { to: string (ex: 5511999999999), text: string }
 * Envia mensagem de texto. Se fora da janela de 24h, retorna erro para o cliente exibir aviso.
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicMember();
    const body = await request.json();
    const { to, text } = body as { to?: string; text?: string };

    if (!to || typeof to !== "string" || !text || typeof text !== "string") {
      return NextResponse.json(
        { error: "to e text são obrigatórios" },
        { status: 400 }
      );
    }

    const normalizedTo = to.replace(/\D/g, "");
    if (normalizedTo.length < 10) {
      return NextResponse.json(
        { error: "Número inválido" },
        { status: 400 }
      );
    }

    const within24 = await isWithin24HourWindow(clinicId, normalizedTo);
    if (!within24) {
      return NextResponse.json(
        { error: "outside_24h", message: "Só é possível enviar mensagem de texto se o paciente tiver enviado uma mensagem nas últimas 24 horas." },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(
      clinicId,
      { to: normalizedTo, text: text.trim() },
      true
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Falha ao enviar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
