import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeAndWait } from "@/lib/transcribe-api";
import { runVirtualAssistantAgent } from "./agent";
import { sendAssistantReply } from "./send-reply";
import type { AiConversationState, VirtualAssistantSettings } from "./types";
import { isInsideAutoMessageWindow } from "@/lib/whatsapp-ops-controls";

async function downloadMediaAsBuffer(mediaUrl: string): Promise<Buffer> {
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Falha ao baixar mídia (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function parseTimeToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isInsideBotWindow(settings: Partial<VirtualAssistantSettings>): boolean {
  if (!settings.bot_active_start && !settings.bot_active_end) return true;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(settings.bot_active_start, 0);
  const end = parseTimeToMinutes(settings.bot_active_end, 24 * 60 - 1);
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

export async function isVirtualAssistantActive(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ active: boolean; settings: Partial<VirtualAssistantSettings> | null }> {
  const { data } = await supabase
    .from("clinic_virtual_assistant_settings")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!data?.enabled) return { active: false, settings: data };

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("plan_id, subscription_status")
    .eq("id", clinicId)
    .single();

  let planAllows = true;
  if (clinicRow?.plan_id) {
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("virtual_assistant_enabled, whatsapp_enabled")
      .eq("id", clinicRow.plan_id)
      .maybeSingle();
    if (!planError && plan) {
      planAllows =
        plan.virtual_assistant_enabled === true || plan.whatsapp_enabled === true;
    }
  }

  const subscriptionOk =
    !clinicRow?.subscription_status ||
    clinicRow.subscription_status === "active" ||
    clinicRow.subscription_status === "trialing";

  return {
    active: Boolean(data?.enabled) && subscriptionOk && planAllows,
    settings: data as Partial<VirtualAssistantSettings>,
  };
}

export async function processConversationAi(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, clinic_id, phone_number, ai_enabled, ai_handoff_at, ai_debounce_until, ai_state, patient_id"
    )
    .eq("id", conversationId)
    .single();

  if (!conv) return;
  if (conv.ai_handoff_at || conv.ai_enabled === false) return;

  const debounceUntil = conv.ai_debounce_until ? new Date(conv.ai_debounce_until).getTime() : 0;
  if (debounceUntil > Date.now()) {
    const waitMs = debounceUntil - Date.now() + 100;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const { active, settings } = await isVirtualAssistantActive(supabase, conv.clinic_id);
  if (!active || !settings) return;

  const { data: pending } = await supabase
    .from("whatsapp_messages")
    .select("id, content, message_type, media_url, sent_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .order("sent_at", { ascending: true });

  if (!pending?.length) return;

  const userTexts: string[] = [];
  for (const msg of pending) {
    let text = String(msg.content ?? "").trim();
    if (msg.message_type === "audio" && msg.media_url) {
      try {
        const buffer = await downloadMediaAsBuffer(msg.media_url);
        text = await transcribeAndWait(
          buffer,
          `whatsapp-${msg.id}.ogg`,
          `clinic-${conv.clinic_id}`,
          "whatsapp"
        );
        await supabase
          .from("whatsapp_messages")
          .update({ content: text })
          .eq("id", msg.id);
      } catch (e) {
        console.error("[VirtualAssistant] transcribe:", e);
        text = "[áudio não transcrito]";
      }
    }
    if (text && text !== "[audio]" && !text.startsWith("[")) {
      userTexts.push(text);
    } else if (msg.message_type === "image" || msg.message_type === "video") {
      userTexts.push(`[Paciente enviou ${msg.message_type}]`);
    }
  }

  if (!userTexts.length) {
    const now = new Date().toISOString();
    await supabase
      .from("whatsapp_messages")
      .update({ ai_processed_at: now })
      .in(
        "id",
        pending.map((m) => m.id)
      );
    return;
  }

  if (!isInsideBotWindow(settings)) {
    const canAuto = await isInsideAutoMessageWindow(conv.clinic_id, supabase);
    if (!canAuto) {
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        "No momento estamos fora do horário de atendimento automático. Deixe sua mensagem que retornamos em breve!"
      );
      return;
    }
  }

  const maxHistory = settings.max_context_messages ?? 20;
  const { data: historyRows } = await supabase
    .from("whatsapp_messages")
    .select("direction, content, sent_at")
    .eq("conversation_id", conversationId)
    .not("ai_processed_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(maxHistory * 2);

  const history = (historyRows ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: String(m.content ?? ""),
    }))
    .filter((m) => m.content.trim());

  const aiState = (conv.ai_state ?? {}) as AiConversationState;

  const combinedText = userTexts.join(" ").toLowerCase();
  if (aiState.pending_confirmation_appointment_id && aiState.patient_id) {
    const { parseConfirmationReply } = await import("./confirmations");
    const { confirmAppointmentViaAssistant, cancelAppointmentViaAssistant } = await import(
      "./services/appointments"
    );
    const reply = parseConfirmationReply(combinedText);
    if (reply === "yes") {
      const res = await confirmAppointmentViaAssistant(
        supabase,
        conv.clinic_id,
        aiState.pending_confirmation_appointment_id,
        aiState.patient_id
      );
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_last_processed_message_at: now,
          ai_state: { ...aiState, pending_confirmation_appointment_id: undefined, intent: undefined },
          ai_debounce_until: null,
        })
        .eq("id", conversationId);
      await supabase
        .from("whatsapp_ai_confirmation_outreach")
        .update({ confirmed_at: now })
        .eq("appointment_id", aiState.pending_confirmation_appointment_id);
      let msg = "Perfeito! Sua consulta está confirmada. ✅";
      if (res.recommendations) {
        msg += `\n\n📋 Recomendações:\n${res.recommendations}`;
      }
      await sendAssistantReply(supabase, conv.clinic_id, conversationId, conv.phone_number, msg);
      return;
    }
    if (reply === "no") {
      await cancelAppointmentViaAssistant(
        supabase,
        conv.clinic_id,
        aiState.pending_confirmation_appointment_id,
        aiState.patient_id
      );
      const now = new Date().toISOString();
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .in(
          "id",
          pending.map((m) => m.id)
        );
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_last_processed_message_at: now,
          ai_state: { ...aiState, pending_confirmation_appointment_id: undefined },
          ai_debounce_until: null,
        })
        .eq("id", conversationId);
      await sendAssistantReply(
        supabase,
        conv.clinic_id,
        conversationId,
        conv.phone_number,
        "Entendido. Sua consulta foi cancelada. Se quiser remarcar, é só me avisar!"
      );
      return;
    }
  }

  const { reply, handoff, statePatch } = await runVirtualAssistantAgent({
    supabase,
    clinicId: conv.clinic_id,
    conversationId,
    phoneNumber: conv.phone_number,
    userMessages: userTexts,
    settings,
    aiState,
    history,
  }).catch((e) => {
    console.error("[VirtualAssistant] agent error:", e);
    const msg =
      e instanceof Error && e.message.includes("OPENAI_API_KEY")
        ? "Desculpe, o assistente não está configurado no momento. Vou chamar alguém da equipe."
        : "Desculpe, tive um problema técnico. Pode tentar de novo em instantes?";
    return { reply: msg, handoff: false, statePatch: aiState };
  });

  const now = new Date().toISOString();
  await supabase
    .from("whatsapp_messages")
    .update({ ai_processed_at: now })
    .in(
      "id",
      pending.map((m) => m.id)
    );

  await supabase
    .from("whatsapp_conversations")
    .update({
      ai_last_processed_message_at: now,
      ai_state: statePatch ?? aiState,
      ai_debounce_until: null,
    })
    .eq("id", conversationId);

  if (!handoff) {
    await sendAssistantReply(supabase, conv.clinic_id, conversationId, conv.phone_number, reply);
  } else {
    await sendAssistantReply(supabase, conv.clinic_id, conversationId, conv.phone_number, reply);
  }
}

export async function scheduleAiDebounce(
  supabase: SupabaseClient,
  conversationId: string,
  _clinicId: string,
  debounceSeconds: number
): Promise<void> {
  const debounceUntil = new Date(Date.now() + debounceSeconds * 1000).toISOString();
  await supabase
    .from("whatsapp_conversations")
    .update({ ai_debounce_until: debounceUntil })
    .eq("id", conversationId);

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[VirtualAssistant] CRON_SECRET não configurado — use o cron /api/cron/process-whatsapp-ai");
    return;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!baseUrl) {
    console.warn("[VirtualAssistant] NEXT_PUBLIC_APP_URL não configurado");
    return;
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/internal/process-whatsapp-ai`;

  void fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId }),
  }).catch((e) => {
    console.error("[VirtualAssistant] falha ao disparar processamento:", e);
  });
}

export async function shouldSkipMenuChatbot(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<boolean> {
  const { active } = await isVirtualAssistantActive(supabase, clinicId);
  if (!active) return false;

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("ai_handoff_at, ai_enabled")
    .eq("id", conversationId)
    .single();

  if (conv?.ai_handoff_at || conv?.ai_enabled === false) return false;
  return true;
}

export async function pauseAiOnManualReply(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .update({ ai_enabled: false })
    .eq("id", conversationId);
}
