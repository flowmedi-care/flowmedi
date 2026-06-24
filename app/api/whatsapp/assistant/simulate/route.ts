import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import {
  processConversationAi,
  scheduleAiDebounce,
} from "@/lib/virtual-assistant/process-inbound";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

/**
 * POST /api/whatsapp/assistant/simulate
 * Body: { phone: string, text: string, processImmediately?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicAdmin();
    const body = (await request.json()) as {
      phone?: string;
      text?: string;
      processImmediately?: boolean;
    };

    const phoneRaw = String(body.phone ?? "").trim();
    const text = String(body.text ?? "").trim();
    if (!phoneRaw || !text) {
      return NextResponse.json({ error: "phone e text são obrigatórios" }, { status: 400 });
    }

    const phone = normalizeWhatsAppPhone(phoneRaw.replace(/\D/g, ""));
    const supabase = createServiceRoleClient();
    const simulateTag = `[simulação ${new Date().toISOString()}]`;

    let conversationId: string;
    const { data: existing } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone_number", phone)
      .maybeSingle();

    if (existing?.id) {
      conversationId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("whatsapp_conversations")
        .insert({
          clinic_id: clinicId,
          phone_number: phone,
          status: "open",
        })
        .select("id")
        .single();
      if (createErr || !created?.id) {
        return NextResponse.json(
          { error: createErr?.message ?? "Falha ao criar conversa de teste" },
          { status: 500 }
        );
      }
      conversationId = created.id;
    }

    const { data: msg, error: msgErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        clinic_id: clinicId,
        direction: "inbound",
        message_type: "text",
        content: text,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    logAiEvent(supabase, {
      clinicId,
      conversationId,
      messageId: msg?.id,
      stage: "simulate_inbound",
      detail: { phone, textPreview: text.slice(0, 80), tag: simulateTag },
    });

    const { data: vaSettings } = await supabase
      .from("clinic_virtual_assistant_settings")
      .select("message_debounce_seconds")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const debounceSec = Number(vaSettings?.message_debounce_seconds) || 5;

    if (body.processImmediately) {
      await supabase
        .from("whatsapp_conversations")
        .update({ ai_debounce_until: new Date().toISOString() })
        .eq("id", conversationId);
      await processConversationAi(supabase, conversationId);
    } else {
      await scheduleAiDebounce(supabase, conversationId, clinicId, debounceSec);
    }

    const diagnostics = await gatherAssistantDiagnostics(supabase, clinicId);

    return NextResponse.json({
      ok: true,
      conversationId,
      messageId: msg?.id,
      phone,
      debounceSeconds: body.processImmediately ? 0 : debounceSec,
      ...diagnostics,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na simulação";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
