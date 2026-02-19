import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { sendWhatsAppMessage, isWithin24HourWindow } from "@/lib/comunicacao/whatsapp";

/**
 * Envia mensagem WhatsApp
 * POST /api/whatsapp/send
 * Body: { conversation_id: string, text: string, forceTemplate?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const member = await requireClinicMember();
    const supabase = await createClient();
    const body = await request.json();

    const { conversation_id, text, forceTemplate } = body;

    if (!conversation_id || !text) {
      return NextResponse.json(
        { error: "conversation_id e text são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar conversa
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("phone_number")
      .eq("id", conversation_id)
      .eq("clinic_id", member.clinicId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const phoneNumber = conversation.phone_number;
    const withinWindow = await isWithin24HourWindow(member.clinicId, phoneNumber);

    // Se não está na janela de 24h e não forçou template, retornar erro
    if (!withinWindow && !forceTemplate) {
      return NextResponse.json(
        {
          error: "outside_24h_window",
          message: "Fora da janela de 24h. Use template ou confirme envio.",
          withinWindow: false,
        },
        { status: 400 }
      );
    }

    // Enviar mensagem
    const result = await sendWhatsAppMessage(
      member.clinicId,
      {
        to: phoneNumber,
        text: withinWindow && !forceTemplate ? text : undefined,
        template: !withinWindow || forceTemplate ? "hello_world" : undefined,
      },
      true // preferSimple
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, debug: result.debug },
        { status: 400 }
      );
    }

    // Salvar mensagem no banco
    const { data: message } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id,
        clinic_id: member.clinicId,
        message_id: result.messageId,
        direction: "outbound",
        message_type: "text",
        content: text,
        status: "sent",
      })
      .select()
      .single();

    // Atualizar conversa
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.substring(0, 50),
        unread_count: 0,
      })
      .eq("id", conversation_id);

    return NextResponse.json({
      success: true,
      message,
      withinWindow,
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar mensagem" },
      { status: 500 }
    );
  }
}
