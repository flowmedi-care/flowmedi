import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

/**
 * POST /api/whatsapp/send
 * Body: { to: string (ex: 5511999999999), text: string }
 * Envia mensagem de texto e persiste na conversa para aparecer no chat.
 * (Regra de 24h pode ser reimplementada depois.)
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

    const normalizedTo = normalizeWhatsAppPhone(to.replace(/\D/g, ""));
    if (normalizedTo.length < 10) {
      return NextResponse.json(
        { error: "Número inválido" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await sendWhatsAppMessage(
      clinicId,
      { to: normalizedTo, text: text.trim() },
      true,
      supabase
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Falha ao enviar" },
        { status: 500 }
      );
    }

    const { data: existing } = await supabase
      .from("whatsapp_conversations")
      .select("id, status")
      .eq("clinic_id", clinicId)
      .eq("phone_number", normalizedTo)
      .maybeSingle();

    // Verificar se pode enviar texto livre (só se status for "open")
    if (existing?.status && existing.status !== "open") {
      return NextResponse.json(
        { 
          error: `Conversa está ${existing.status === "closed" ? "fechada" : "concluída"}. Apenas mensagens template são permitidas.`,
          status: existing.status
        },
        { status: 403 }
      );
    }

    let conversationId: string;
    if (existing?.id) {
      conversationId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("whatsapp_conversations")
        .insert({ 
          clinic_id: clinicId, 
          phone_number: normalizedTo,
          status: "open"
        })
        .select("id")
        .single();
      if (insertErr || !inserted?.id) {
        return NextResponse.json({ success: true, messageId: result.messageId });
      }
      conversationId = inserted.id;
    }

    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      clinic_id: clinicId,
      direction: "outbound",
      message_type: "text",
      content: text.trim(),
      sent_at: new Date().toISOString(),
    } as Record<string, unknown>);

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
