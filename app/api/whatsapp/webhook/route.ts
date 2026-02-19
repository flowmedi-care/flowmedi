import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VERIFY_TOKEN = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "flowmedi-verify";

/**
 * GET /api/whatsapp/webhook
 * Verificação do webhook pela Meta: hub.mode, hub.verify_token, hub.challenge.
 * Configure a mesma string em META_WHATSAPP_WEBHOOK_VERIFY_TOKEN no app da Meta.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Recebe notificações da Meta quando alguém envia mensagem.
 * Payload: entry[].changes[].value.messages[] e value.metadata.phone_number_id.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Responder 200 rápido para a Meta não reenviar
    const entry = body?.entry;
    if (!Array.isArray(entry) || entry.length === 0) {
      return new NextResponse(null, { status: 200 });
    }

    for (const e of entry) {
      const changes = e?.changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id as string | undefined;
        const messages = value.messages;
        if (!phoneNumberId || !Array.isArray(messages)) continue;

        const supabase = await createClient();
        const { data: integrations } = await supabase
          .from("clinic_integrations")
          .select("clinic_id, metadata")
          .in("integration_type", ["whatsapp_simple", "whatsapp_meta"])
          .eq("status", "connected");

        const integration = (integrations || []).find(
          (i) => (i.metadata as { phone_number_id?: string })?.phone_number_id === phoneNumberId
        );
        const clinicId = integration?.clinic_id ?? null;
        if (!clinicId) continue;

        for (const msg of messages) {
          const from = String(msg.from ?? "").replace(/\D/g, "");
          if (!from) continue;
          let bodyText: string | null = null;
          if (msg.text?.body) bodyText = String(msg.text.body);
          else if (msg.type) bodyText = `[${msg.type}]`;

          const conversationRes = await supabase
            .from("whatsapp_conversations")
            .select("id")
            .eq("clinic_id", clinicId)
            .eq("phone_number", from)
            .maybeSingle();

          let conversationId: string;
          if (conversationRes.data?.id) {
            conversationId = conversationRes.data.id;
          } else {
            const insertConv = await supabase
              .from("whatsapp_conversations")
              .insert({ clinic_id: clinicId, phone_number: from })
              .select("id")
              .single();
            if (insertConv.error || !insertConv.data?.id) continue;
            conversationId = insertConv.data.id;
          }

          await supabase.from("whatsapp_messages").insert({
            conversation_id: conversationId,
            direction: "inbound",
            body: bodyText,
            sent_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (_) {
    // não falhar o webhook para a Meta
  }
  return new NextResponse(null, { status: 200 });
}
