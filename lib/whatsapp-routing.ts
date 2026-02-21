import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "./comunicacao/whatsapp";

const CHATBOT_MENU = `Olá! Como posso ajudar?

1️⃣ Agendar consulta
2️⃣ Remarcar
3️⃣ Cancelar
4️⃣ Falar com atendente

Digite o número da opção desejada.`;

export type RoutingResult = {
  assignedSecretaryId: string | null;
  eligibleSecretaryIds: string[];
};

/**
 * Verifica se a primeira mensagem contém código de referência de médico.
 * Se sim, atribui a conversa à secretária do médico e retorna true.
 */
export async function applyReferralRoutingIfMatch(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  firstMessageText: string
): Promise<boolean> {
  const text = String(firstMessageText ?? "").trim().toLowerCase();
  if (!text) return false;

  const { data: codes } = await supabase
    .from("doctor_referral_codes")
    .select("doctor_id, code")
    .eq("clinic_id", clinicId);

  const list = (codes ?? []) as { doctor_id: string; code: string }[];
  let matchedDoctorId: string | null = null;
  for (const row of list) {
    const code = String(row.code ?? "").trim().toLowerCase();
    if (code && text.includes(code)) {
      matchedDoctorId = row.doctor_id;
      break;
    }
  }
  if (!matchedDoctorId) return false;

  const { data: sdRows } = await supabase
    .from("secretary_doctors")
    .select("secretary_id")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", matchedDoctorId);

  const secretaryIds = [...new Set((sdRows ?? []).map((s) => (s as { secretary_id: string }).secretary_id))];
  if (secretaryIds.length === 0) return false;

  const { data: settings } = await supabase
    .from("clinic_whatsapp_routing_settings")
    .select("chatbot_fallback_strategy")
    .eq("clinic_id", clinicId)
    .single();

  const fallback = (settings as { chatbot_fallback_strategy?: string })?.chatbot_fallback_strategy ?? "first_responder";

  if (secretaryIds.length === 1) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        assigned_secretary_id: secretaryIds[0],
        assigned_at: new Date().toISOString(),
        chatbot_step: "done",
      })
      .eq("id", conversationId);
    return true;
  }

  if (fallback === "round_robin") {
    const chosen = await pickFromSecretaryList(supabase, clinicId, secretaryIds);
    if (chosen) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          assigned_secretary_id: chosen,
          assigned_at: new Date().toISOString(),
          chatbot_step: "done",
        })
        .eq("id", conversationId);
      return true;
    }
  }

  await supabase
    .from("conversation_eligible_secretaries")
    .insert(secretaryIds.map((sid) => ({ conversation_id: conversationId, secretary_id: sid })));
  await supabase
    .from("whatsapp_conversations")
    .update({ chatbot_step: "done" })
    .eq("id", conversationId);
  return true;
}

export async function applyRoutingOnNewConversation(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<RoutingResult> {
  const { data: settings } = await supabase
    .from("clinic_whatsapp_routing_settings")
    .select("routing_strategy, general_secretary_id")
    .eq("clinic_id", clinicId)
    .single();

  const strategy = (settings as { routing_strategy?: string })?.routing_strategy ?? "first_responder";
  const generalSecretaryId = (settings as { general_secretary_id?: string | null })?.general_secretary_id ?? null;

  if (strategy === "general_secretary" && generalSecretaryId) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        assigned_secretary_id: generalSecretaryId,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
    return { assignedSecretaryId: generalSecretaryId, eligibleSecretaryIds: [] };
  }

  if (strategy === "chatbot") {
    await supabase
      .from("whatsapp_conversations")
      .update({ chatbot_step: "menu" })
      .eq("id", conversationId);
    return { assignedSecretaryId: null, eligibleSecretaryIds: [] };
  }

  if (strategy === "round_robin") {
    const secretaryId = await pickSecretaryWithFewestConversations(supabase, clinicId);
    if (secretaryId) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          assigned_secretary_id: secretaryId,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
      return { assignedSecretaryId: secretaryId, eligibleSecretaryIds: [] };
    }
  }

  return { assignedSecretaryId: null, eligibleSecretaryIds: [] };
}

async function pickSecretaryWithFewestConversations(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string | null> {
  const { data: secretaries } = await supabase
    .from("profiles")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("role", "secretaria")
    .or("active.eq.true,active.is.null");
  const secIds = (secretaries ?? []).map((s) => s.id);
  if (secIds.length === 0) return null;

  const { data: counts } = await supabase
    .from("whatsapp_conversations")
    .select("assigned_secretary_id")
    .eq("clinic_id", clinicId)
    .eq("status", "open");
  const bySecretary = new Map<string, number>();
  for (const sid of secIds) bySecretary.set(sid, 0);
  for (const row of counts ?? []) {
    const aid = (row as { assigned_secretary_id?: string | null }).assigned_secretary_id;
    if (aid && secIds.includes(aid)) {
      bySecretary.set(aid, (bySecretary.get(aid) ?? 0) + 1);
    }
  }
  let minCount = Infinity;
  let chosen: string | null = null;
  for (const [sid, c] of bySecretary) {
    if (c < minCount) {
      minCount = c;
      chosen = sid;
    }
  }
  return chosen;
}

async function pickFromSecretaryList(
  supabase: SupabaseClient,
  clinicId: string,
  secretaryIds: string[]
): Promise<string | null> {
  if (secretaryIds.length === 0) return null;
  const { data: counts } = await supabase
    .from("whatsapp_conversations")
    .select("assigned_secretary_id")
    .eq("clinic_id", clinicId)
    .eq("status", "open");
  const bySecretary = new Map<string, number>();
  for (const sid of secretaryIds) bySecretary.set(sid, 0);
  for (const row of counts ?? []) {
    const aid = (row as { assigned_secretary_id?: string | null }).assigned_secretary_id;
    if (aid && secretaryIds.includes(aid)) {
      bySecretary.set(aid, (bySecretary.get(aid) ?? 0) + 1);
    }
  }
  let minCount = Infinity;
  let chosen: string | null = null;
  for (const [sid, c] of bySecretary) {
    if (c < minCount) {
      minCount = c;
      chosen = sid;
    }
  }
  return chosen;
}

async function applyChatbotFallback(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  fallback: string
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .update({ chatbot_step: "done" })
    .eq("id", conversationId);
  if (fallback === "round_robin") {
    const sid = await pickSecretaryWithFewestConversations(supabase, clinicId);
    if (sid) {
      await supabase
        .from("whatsapp_conversations")
        .update({ assigned_secretary_id: sid, assigned_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
  }
}

async function applyChatbotFallbackFromSecretaries(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  secretaryIds: string[],
  fallback: string
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .update({ chatbot_step: "done" })
    .eq("id", conversationId);
  if (fallback === "first_responder" && secretaryIds.length > 0) {
    await supabase
      .from("conversation_eligible_secretaries")
      .insert(secretaryIds.map((sid) => ({ conversation_id: conversationId, secretary_id: sid })));
  } else if (fallback === "round_robin" && secretaryIds.length > 0) {
    const chosen = await pickFromSecretaryList(supabase, clinicId, secretaryIds);
    if (chosen) {
      await supabase
        .from("whatsapp_conversations")
        .update({ assigned_secretary_id: chosen, assigned_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
  }
}

export async function handleChatbotMessage(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  phoneNumber: string,
  userMessage: string
): Promise<{ reply: string | null; done: boolean }> {
  const { data: settings } = await supabase
    .from("clinic_whatsapp_routing_settings")
    .select("routing_strategy, chatbot_fallback_strategy")
    .eq("clinic_id", clinicId)
    .single();
  const strategy = (settings as { routing_strategy?: string })?.routing_strategy ?? "first_responder";
  const chatbotFallback = (settings as { chatbot_fallback_strategy?: string })?.chatbot_fallback_strategy ?? "first_responder";
  if (strategy !== "chatbot") {
    return { reply: null, done: true };
  }

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("chatbot_step")
    .eq("id", conversationId)
    .single();

  const step = (conv as { chatbot_step?: string | null })?.chatbot_step ?? "menu";
  const trimmed = String(userMessage ?? "").trim();

  if (step === "menu") {
    const choice = trimmed.replace(/[^\d]/g, "")[0] ?? "";

    if (choice === "1") {
      const { data: procedures } = await supabase
        .from("procedures")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .order("name");
      const list = (procedures ?? []) as { id: string; name: string }[];
      if (list.length === 0) {
        await applyChatbotFallback(supabase, clinicId, conversationId, chatbotFallback);
        return {
          reply: "Não há procedimentos cadastrados. Um atendente entrará em contato em breve.",
          done: true,
        };
      }
      const lines = list.map((p, i) => `${i + 1}. ${p.name}`);
      await supabase
        .from("whatsapp_conversations")
        .update({ chatbot_step: "awaiting_procedure" })
        .eq("id", conversationId);
      return {
        reply: `Qual procedimento deseja agendar?\n\n${lines.join("\n")}\n\nDigite o número da opção.`,
        done: false,
      };
    }

    if (choice === "2" || choice === "3") {
      const { secretaryId } = await findSecretaryForPatient(supabase, clinicId, phoneNumber);
      if (secretaryId) {
        await supabase
          .from("whatsapp_conversations")
          .update({
            assigned_secretary_id: secretaryId,
            assigned_at: new Date().toISOString(),
            chatbot_step: "done",
          })
          .eq("id", conversationId);
        return {
          reply: "Encaminhando para sua secretária. Aguarde um momento.",
          done: true,
        };
      }
      await applyChatbotFallback(supabase, clinicId, conversationId, chatbotFallback);
      return {
        reply: "Para remarcar ou cancelar, precisamos localizar seu agendamento. Um atendente entrará em contato em breve.",
        done: true,
      };
    }

    if (choice === "4") {
      await applyChatbotFallback(supabase, clinicId, conversationId, chatbotFallback);
      return {
        reply: "Em breve um atendente responderá.",
        done: true,
      };
    }

    return { reply: CHATBOT_MENU, done: false };
  }

  if (step === "awaiting_procedure") {
    const num = parseInt(trimmed.replace(/\D/g, ""), 10);
    const { data: procedures } = await supabase
      .from("procedures")
      .select("id")
      .eq("clinic_id", clinicId)
      .order("name");
    const list = (procedures ?? []) as { id: string }[];
    const idx = num >= 1 && num <= list.length ? num - 1 : -1;

    if (idx >= 0) {
      const procedureId = list[idx].id;
      const { secretaryIds } = await getSecretariesForProcedure(supabase, clinicId, procedureId);

      if (secretaryIds.length === 1) {
        await supabase
          .from("whatsapp_conversations")
          .update({
            assigned_secretary_id: secretaryIds[0],
            assigned_at: new Date().toISOString(),
            chatbot_step: "done",
          })
          .eq("id", conversationId);
      } else if (secretaryIds.length > 1) {
        await applyChatbotFallbackFromSecretaries(supabase, clinicId, conversationId, secretaryIds, chatbotFallback);
      } else {
        await applyChatbotFallback(supabase, clinicId, conversationId, chatbotFallback);
      }

      return {
        reply: "Sua solicitação foi registrada. Um atendente entrará em contato em breve.",
        done: true,
      };
    }

    return {
      reply: "Opção inválida. Digite o número do procedimento desejado.",
      done: false,
    };
  }

  return { reply: null, done: true };
}

async function findSecretaryForPatient(
  supabase: SupabaseClient,
  clinicId: string,
  phoneNumber: string
): Promise<{ secretaryId: string | null }> {
  const norm = phoneNumber.replace(/\D/g, "");
  const { data: patients } = await supabase
    .from("patients")
    .select("id, phone")
    .eq("clinic_id", clinicId)
    .not("phone", "is", null);

  const patient = (patients ?? []).find((p) => {
    const pDigits = (p.phone ?? "").replace(/\D/g, "");
    if (!pDigits) return false;
    return pDigits === norm || `55${pDigits}` === norm;
  });

  if (!patient) return { secretaryId: null };

  const { data: appt } = await supabase
    .from("appointments")
    .select("doctor_id")
    .eq("patient_id", patient.id)
    .neq("status", "cancelada")
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!appt) return { secretaryId: null };

  const { data: sd } = await supabase
    .from("secretary_doctors")
    .select("secretary_id")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", appt.doctor_id)
    .limit(1)
    .maybeSingle();

  return { secretaryId: sd?.secretary_id ?? null };
}

async function getSecretariesForProcedure(
  supabase: SupabaseClient,
  clinicId: string,
  procedureId: string
): Promise<{ secretaryIds: string[] }> {
  const { data: doctorProcs } = await supabase
    .from("doctor_procedures")
    .select("doctor_id")
    .eq("clinic_id", clinicId)
    .eq("procedure_id", procedureId);

  const doctorIds = [...new Set((doctorProcs ?? []).map((d) => d.doctor_id))];
  if (doctorIds.length === 0) return { secretaryIds: [] };

  const { data: sdRows } = await supabase
    .from("secretary_doctors")
    .select("secretary_id")
    .eq("clinic_id", clinicId)
    .in("doctor_id", doctorIds);

  const secretaryIds = [...new Set((sdRows ?? []).map((s) => s.secretary_id))];
  return { secretaryIds };
}

export async function sendChatbotMenuIfNeeded(
  supabase: SupabaseClient,
  clinicId: string,
  phoneNumber: string,
  conversationId: string
): Promise<void> {
  const result = await sendWhatsAppMessage(
    clinicId,
    { to: phoneNumber, text: CHATBOT_MENU },
    true,
    supabase
  );
  if (result.success) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      clinic_id: clinicId,
      direction: "outbound",
      message_type: "text",
      content: CHATBOT_MENU,
      sent_at: new Date().toISOString(),
    } as Record<string, unknown>);
  }
}

export async function sendChatbotReply(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  phoneNumber: string,
  reply: string
): Promise<void> {
  const result = await sendWhatsAppMessage(
    clinicId,
    { to: phoneNumber, text: reply },
    true,
    supabase
  );
  if (result.success) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      clinic_id: clinicId,
      direction: "outbound",
      message_type: "text",
      content: reply,
      sent_at: new Date().toISOString(),
    } as Record<string, unknown>);
  }
}
