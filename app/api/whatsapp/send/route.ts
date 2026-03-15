import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { sendWhatsAppMessage } from "@/lib/comunicacao/whatsapp";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";
import { getAndSyncEffectiveTicketStatus } from "@/lib/whatsapp-ticket-status";

const FREE_MESSAGE_TEMPLATE_KEY = "flowmedi_mensagem_livre";

function normalizePhoneForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

/**
 * POST /api/whatsapp/send
 * Body: { to: string (ex: 5511999999999), text: string }
 * Envia mensagem de texto e persiste na conversa para aparecer no chat.
 * (Regra de 24h pode ser reimplementada depois.)
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
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
    const { data: existing } = await supabase
      .from("whatsapp_conversations")
      .select("id, status, assigned_secretary_id, last_inbound_message_at, contact_name")
      .eq("clinic_id", clinicId)
      .eq("phone_number", normalizedTo)
      .maybeSingle();

    const conversationStatus = await getAndSyncEffectiveTicketStatus(
      clinicId,
      existing
        ? {
            id: existing.id,
            status: existing.status ?? null,
            last_inbound_message_at: existing.last_inbound_message_at ?? null,
          }
        : null,
      supabase
    );

    const sanitizedText = text.trim();
    const useTemplateMode = conversationStatus !== "open";

    let result;
    if (useTemplateMode) {
      const { data: clinicTemplate } = await supabase
        .from("clinic_whatsapp_meta_templates")
        .select("template_name, status")
        .eq("clinic_id", clinicId)
        .eq("template_key", FREE_MESSAGE_TEMPLATE_KEY)
        .maybeSingle();

      const templateStatus = String(clinicTemplate?.status || "PENDING").toUpperCase();
      if (!clinicTemplate?.template_name || templateStatus !== "APPROVED") {
        return NextResponse.json(
          {
            error:
              "Para iniciar conversa fora da janela de 24h, solicite e aprove o template de mensagem livre da clínica.",
            status: conversationStatus ?? "closed",
          },
          { status: 403 }
        );
      }

      const { data: patients } = await supabase
        .from("patients")
        .select("full_name, phone")
        .eq("clinic_id", clinicId)
        .not("phone", "is", null);

      const normalizedTarget = normalizePhoneForMatch(normalizedTo);
      const matchedPatient = (patients ?? []).find((row) => {
        const candidate = normalizePhoneForMatch(String(row.phone ?? ""));
        return Boolean(candidate) && candidate === normalizedTarget;
      });

      const recipientName = (
        matchedPatient?.full_name ||
        existing?.contact_name ||
        "Paciente"
      ).slice(0, 256);

      result = await sendWhatsAppMessage(
        clinicId,
        {
          to: normalizedTo,
          template: clinicTemplate.template_name,
          templateParams: [recipientName, sanitizedText.slice(0, 900)],
        },
        false,
        supabase
      );
    } else {
      result = await sendWhatsAppMessage(
        clinicId,
        { to: normalizedTo, text: sanitizedText },
        false,
        supabase
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Falha ao enviar" },
        { status: 500 }
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
          status: useTemplateMode ? "closed" : "open"
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
      content: sanitizedText,
      sent_at: new Date().toISOString(),
    } as Record<string, unknown>);

    // Primeira que responde assume: secretária envia em conversa em pool → atribui a ela
    if (role === "secretaria" && existing?.assigned_secretary_id == null) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          assigned_secretary_id: userId,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
      await supabase
        .from("conversation_eligible_secretaries")
        .delete()
        .eq("conversation_id", conversationId);
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
