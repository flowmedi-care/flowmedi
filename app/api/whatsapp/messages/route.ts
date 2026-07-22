import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";
import { createAuthenticatedSignedUrl } from "@/lib/storage/signed-url";
import { WHATSAPP_MEDIA_BUCKET } from "@/lib/whatsapp-media";
import {
  clampMessagesLimit,
  encodeMessageCursor,
  parseMessageCursor,
} from "@/lib/whatsapp/message-cursor";

type MessageRow = {
  id: string;
  direction: string;
  content?: string | null;
  media_url?: string | null;
  message_type?: string | null;
  sent_at: string;
  sender_type?: string | null;
  sender_name?: string | null;
  sender_user_id?: string | null;
  ai_processed_at?: string | null;
};

const SELECT_COLS =
  "id, direction, content, media_url, message_type, sent_at, sender_type, sender_name, sender_user_id, ai_processed_at";

/** Valor seguro para filtros PostgREST (.or) com timestamps. */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function beforeOrFilter(sentAt: string, id: string): string {
  const ts = quoteFilterValue(sentAt);
  return `sent_at.lt.${ts},and(sent_at.eq.${ts},id.lt.${id})`;
}

function afterOrFilter(sentAt: string, id: string): string {
  const ts = quoteFilterValue(sentAt);
  return `sent_at.gt.${ts},and(sent_at.eq.${ts},id.gt.${id})`;
}

async function mapMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: MessageRow[]
) {
  return Promise.all(
    rows.map(async (r) => {
      let mediaUrl = r.media_url ?? null;
      if (mediaUrl) {
        const signed = await createAuthenticatedSignedUrl(
          supabase,
          WHATSAPP_MEDIA_BUCKET,
          mediaUrl
        );
        mediaUrl = signed.url ?? mediaUrl;
      }

      return {
        id: r.id,
        direction: r.direction,
        body: r.content ?? null,
        media_url: mediaUrl,
        message_type: r.message_type ?? "text",
        sent_at: r.sent_at,
        sender_type: r.sender_type ?? null,
        sender_name: r.sender_name ?? null,
        sender_user_id: r.sender_user_id ?? null,
        ai_processed_at: r.ai_processed_at ?? null,
      };
    })
  );
}

/**
 * GET /api/whatsapp/messages?conversationId=...&limit=50&before=...&after=...
 * Paginação por cursor composto (sent_at|id). before e after são mutuamente exclusivos.
 * Resposta sempre ASC. Cliente não reconstrói cursores a partir do array.
 */
export async function GET(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicMember();
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório" },
        { status: 400 }
      );
    }

    const beforeRaw = request.nextUrl.searchParams.get("before");
    const afterRaw = request.nextUrl.searchParams.get("after");
    if (beforeRaw && afterRaw) {
      return NextResponse.json(
        { error: "before e after são mutuamente exclusivos" },
        { status: 400 }
      );
    }

    const limit = clampMessagesLimit(request.nextUrl.searchParams.get("limit"));
    const before = parseMessageCursor(beforeRaw);
    const after = parseMessageCursor(afterRaw);

    if (beforeRaw && !before) {
      return NextResponse.json({ error: "cursor before inválido" }, { status: 400 });
    }
    if (afterRaw && !after) {
      return NextResponse.json({ error: "cursor after inválido" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: conv, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("clinic_id", clinicId)
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    let rows: MessageRow[] = [];
    let hasMoreOlder = false;

    if (after) {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(SELECT_COLS)
        .eq("conversation_id", conversationId)
        .or(afterOrFilter(after.sentAt, after.id))
        .order("sent_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit);

      if (error) {
        console.error("[WhatsApp Messages] Erro after:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rows = (data ?? []) as MessageRow[];
      // Client deve ignorar hasMoreOlder no path after e manter o valor local.
      hasMoreOlder = false;
    } else if (before) {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(SELECT_COLS)
        .eq("conversation_id", conversationId)
        .or(beforeOrFilter(before.sentAt, before.id))
        .order("sent_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (error) {
        console.error("[WhatsApp Messages] Erro before:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const fetched = (data ?? []) as MessageRow[];
      hasMoreOlder = fetched.length > limit;
      rows = fetched.slice(0, limit).reverse();
    } else {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(SELECT_COLS)
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (error) {
        console.error("[WhatsApp Messages] Erro:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const fetched = (data ?? []) as MessageRow[];
      hasMoreOlder = fetched.length > limit;
      rows = fetched.slice(0, limit).reverse();
    }

    const messages = await mapMessages(supabase, rows);
    const oldest = rows[0];
    const newest = rows[rows.length - 1];

    return NextResponse.json({
      messages,
      hasMoreOlder,
      oldestCursor: oldest ? encodeMessageCursor(oldest.sent_at, oldest.id) : null,
      newestCursor: newest ? encodeMessageCursor(newest.sent_at, newest.id) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar mensagens";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
