import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/unread-count
 * Retorna o total de mensagens não lidas das conversas que o usuário pode ver.
 * Admin: todas. Secretária: apenas atribuídas a ela ou em pool elegível (ou secretária geral vê as sem atribuição).
 */
export async function GET() {
  try {
    const { clinicId, role, id: userId } = await requireClinicMemberWithRole();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: allConvs } = await supabase
      .from("whatsapp_conversations")
      .select("id, assigned_secretary_id")
      .eq("clinic_id", clinicId);

    if (!allConvs || allConvs.length === 0) {
      return NextResponse.json({ total: 0, byConversation: {} });
    }

    const roleNorm = String(role ?? "").toLowerCase().trim();
    const isAdmin = roleNorm === "admin";

    let conversationIds: string[] = allConvs.map((c) => c.id);
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
        .select("conversation_id, secretary_id")
        .in("conversation_id", conversationIds);
      const eligibleByConv = new Map<string, Set<string>>();
      for (const e of allEligible ?? []) {
        const cid = String(e.conversation_id);
        const sid = String(e.secretary_id);
        if (!eligibleByConv.has(cid)) eligibleByConv.set(cid, new Set());
        eligibleByConv.get(cid)!.add(sid);
      }

      const uid = String(userId ?? "");
      conversationIds = allConvs
        .filter((c) => {
          const aid = c.assigned_secretary_id ? String(c.assigned_secretary_id) : null;
          if (aid && aid === uid) return true;
          if (aid) return false;
          if (strategy === "general_secretary" && generalSecretaryId) {
            return uid === generalSecretaryId;
          }
          const eligible = eligibleByConv.get(c.id);
          if (!eligible || eligible.size === 0) return true;
          return eligible.has(uid);
        })
        .map((c) => c.id);
    }
    let totalUnread = 0;
    const byConversation: Record<string, number> = {};

    // Para cada conversa, contar mensagens não lidas
    for (const convId of conversationIds) {
      // Buscar última visualização do usuário
      const { data: view } = await supabase
        .from("whatsapp_conversation_views")
        .select("viewed_at")
        .eq("conversation_id", convId)
        .eq("user_id", user.id)
        .maybeSingle();

      // Contar mensagens inbound enviadas após a última visualização
      const { count } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .eq("direction", "inbound")
        .gt("sent_at", view?.viewed_at || "1970-01-01");

      const unreadCount = count || 0;
      if (unreadCount > 0) {
        totalUnread += unreadCount;
        byConversation[convId] = unreadCount;
      }
    }

    return NextResponse.json({ total: totalUnread, byConversation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao contar não lidas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
