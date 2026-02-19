import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";

/**
 * Envia mensagem WhatsApp diretamente (cria conversa se não existir)
 * POST /api/whatsapp/send-direct
 * Body: { to: string, text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const member = await requireClinicMember();
    const supabase = await createClient();
    const body = await request.json();

    const { to, text } = body;

    if (!to || !text) {
      return NextResponse.json(
        { error: "to e text são obrigatórios" },
        { status: 400 }
      );
    }

    // Normalizar número (remover caracteres não numéricos)
    const phoneNumber = to.replace(/\D/g, "");

    // Buscar ou criar conversa
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("clinic_id", member.clinicId)
      .eq("phone_number", phoneNumber)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("whatsapp_conversations")
        .insert({
          clinic_id: member.clinicId,
          phone_number: phoneNumber,
          last_message_preview: text.substring(0, 50),
        })
        .select("id")
        .single();
      conversation = newConv;
    }

    if (!conversation?.id) {
      return NextResponse.json(
        { error: "Erro ao criar/buscar conversa" },
        { status: 500 }
      );
    }

    // Enviar mensagem (sempre como texto simples para teste)
    const result = await sendWhatsAppMessage(
      member.clinicId,
      {
        to: phoneNumber,
        text: text,
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
        conversation_id: conversation.id,
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
      .eq("id", conversation.id);

    return NextResponse.json({
      success: true,
      message,
      conversation_id: conversation.id,
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem direta:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar mensagem" },
      { status: 500 }
    );
  }
}
