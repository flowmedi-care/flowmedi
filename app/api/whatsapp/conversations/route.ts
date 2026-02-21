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

    const roleNorm = String(role ?? "").toLowerCase().trim();
    const isAdmin = roleNorm === "admin";

    const eligibleDetailsByConv = new Map<string, Array<{ id: string; full_name: string | null }>>();

    // Admin: vê todas. Secretária/outros: só vê atribuídas a ela ou em pool elegível
    let conversations = rows;
    if (!isAdmin) {
      const { data: routingSettings } = await supabase
        .from("clinic_whatsapp_routing_settings")
        .select("routing_strategy, general_secretary_id")
        .eq("clinic_id", clinicId)
        .single();
      const strategy = (routingSettings as { routing_strategy?: string })?.routing_strategy ?? "first_responder";
      const generalSecretaryId = (routingSettings as { general_secretary_id?: string | null })?.general_secretary_id
        ? String((routingSettings as { general_secretary_id?: string | null }).general_secretary_id)
        : null;

      const { data: allEligible } = await supabase
        .from("conversation_eligible_secretaries")
        .select("conversation_id, secretary_id, profiles!secretary_id(id, full_name)")
        .in("conversation_id", rows.map((r) => r.id));
      const eligibleByConv = new Map<string, Set<string>>();
      for (const e of allEligible ?? []) {
        const cid = String(e.conversation_id);
        const sid = String(e.secretary_id);
        if (!eligibleByConv.has(cid)) eligibleByConv.set(cid, new Set());
        eligibleByConv.get(cid)!.add(sid);
        const prof = (e as { profiles?: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] }).profiles;
        const p = Array.isArray(prof) ? prof[0] : prof;
        if (!eligibleDetailsByConv.has(cid)) eligibleDetailsByConv.set(cid, []);
        eligibleDetailsByConv.get(cid)!.push({ id: sid, full_name: p?.full_name ?? null });
      }

      const uid = String(userId ?? "");
      conversations = rows.filter((c) => {
        const aid = c.assigned_secretary_id ? String(c.assigned_secretary_id) : null;
        if (aid && aid === uid) return true; // atribuída a mim
        if (aid) return false; // atribuída a outra pessoa
        // assigned = null
        if (strategy === "general_secretary" && generalSecretaryId) {
          return uid === generalSecretaryId; // só a secretária geral vê conversas não atribuídas
        }
        const eligible = eligibleByConv.get(c.id);
        if (!eligible || eligible.size === 0) return true; // pool geral: todas secretárias
        return eligible.has(uid);
      });
    } else {
      const { data: allEligible } = await supabase
        .from("conversation_eligible_secretaries")
        .select("conversation_id, secretary_id, profiles!secretary_id(id, full_name)")
        .in("conversation_id", rows.map((r) => r.id));
      for (const e of allEligible ?? []) {
        const cid = String(e.conversation_id);
        const sid = String(e.secretary_id);
        const prof = (e as { profiles?: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] }).profiles;
        const p = Array.isArray(prof) ? prof[0] : prof;
        if (!eligibleDetailsByConv.has(cid)) eligibleDetailsByConv.set(cid, []);
        eligibleDetailsByConv.get(cid)!.push({ id: sid, full_name: p?.full_name ?? null });
      }
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
      eligible_secretaries: (() => {
        if (c.assigned_secretary_id) return [];
        const details = eligibleDetailsByConv?.get(c.id) ?? [];
        return details;
      })(),
    }));

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar conversas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
