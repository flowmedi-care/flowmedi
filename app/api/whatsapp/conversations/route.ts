import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";

type SecretaryRef = { id: string; full_name: string | null } | null;

type ConversationRow = {
  id: string;
  phone_number: string;
  contact_name: string | null;
  status: string;
  last_inbound_message_at: string | null;
  created_at: string;
  assigned_secretary_id: string | null;
  patient_id: string | null;
  assigned_at: string | null;
  assigned_secretary: SecretaryRef | SecretaryRef[] | null;
};

function normalizeSecretary(
  v: SecretaryRef | SecretaryRef[] | null
): SecretaryRef {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * GET /api/whatsapp/conversations?status=open|closed|completed
 * Lista conversas WhatsApp da clínica.
 * Admin: vê todas. Secretária: vê apenas as atribuídas a ela ou em pool (eligible).
 */
export async function GET(request: Request) {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const selectFields =
      "id, phone_number, contact_name, status, last_inbound_message_at, created_at, assigned_secretary_id, patient_id, assigned_at";

    let query = supabase
      .from("whatsapp_conversations")
      .select(
        `${selectFields}, assigned_secretary:profiles!assigned_secretary_id(id, full_name)`
      )
      .eq("clinic_id", clinicId);

    if (status && ["open", "closed", "completed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: rawConversations, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: ConversationRow[] = (rawConversations ?? []) as unknown[] as ConversationRow[];

    // Admin: vê todas. Secretária/outros: só vê atribuídas a ela ou em pool elegível
    let conversations = rows;
    if (role !== "admin") {
      const { data: allEligible } = await supabase
        .from("conversation_eligible_secretaries")
        .select("conversation_id, secretary_id")
        .in("conversation_id", rows.map((r) => r.id));
      const eligibleByConv = new Map<string, Set<string>>();
      for (const e of allEligible ?? []) {
        if (!eligibleByConv.has(e.conversation_id)) {
          eligibleByConv.set(e.conversation_id, new Set());
        }
        eligibleByConv.get(e.conversation_id)!.add(e.secretary_id);
      }

      conversations = rows.filter((c) => {
        if (c.assigned_secretary_id === userId) return true;
        if (c.assigned_secretary_id) return false;
        const eligible = eligibleByConv.get(c.id);
        if (!eligible || eligible.size === 0) return true; // pool geral: todas secretárias
        return eligible.has(userId);
      });
    }

    const result = conversations.map((c) => ({
      id: c.id,
      phone_number: c.phone_number,
      contact_name: c.contact_name,
      status: c.status,
      last_inbound_message_at: c.last_inbound_message_at,
      created_at: c.created_at,
      assigned_secretary_id: c.assigned_secretary_id,
      assigned_secretary: (() => {
        const s = normalizeSecretary(c.assigned_secretary);
        return s ? { id: s.id, full_name: s.full_name } : null;
      })(),
      assigned_at: c.assigned_at,
    }));

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar conversas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
