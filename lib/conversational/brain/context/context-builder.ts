import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClinicContext } from "@/lib/virtual-assistant/clinic-context";
import { loadContactJourneyForAi } from "@/lib/contact-journey/journey-for-ai";
import type { ClinicConfig } from "../../clinic/clinic-config";
import type { Conversation } from "../../domain/conversation/conversation";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { HistoryMessage } from "../types/messages";
import {
  initialOperationalMemory,
  type OperationalMemory,
} from "../types/memory";
import type { ClinicSummary, TurnContext } from "../types/turn-context";

const clinicSummaryCache = new Map<string, { at: number; summary: ClinicSummary }>();
const CLINIC_CACHE_MS = 5 * 60 * 1000;

function operationalFromAiState(aiState?: AiConversationState): OperationalMemory {
  const brain = (aiState as AiConversationState & { brain_v2?: { operational?: OperationalMemory } })
    ?.brain_v2?.operational;
  if (brain) return { ...initialOperationalMemory(), ...brain };
  return initialOperationalMemory();
}

async function loadClinicSummary(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicSummary> {
  const cached = clinicSummaryCache.get(clinicId);
  if (cached && Date.now() - cached.at < CLINIC_CACHE_MS) {
    return cached.summary;
  }

  const { text, clinicName } = await buildClinicContext(supabase, clinicId);
  const { data: procedures } = await supabase
    .from("procedures")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name")
    .limit(15);

  const hoursMatch = text.match(/## Horários[\s\S]*?\n([\s\S]*?)(?:\n##|$)/);
  const addressMatch = text.match(/## Clínica[\s\S]*?Endereço:\s*(.+)/);

  const summary: ClinicSummary = {
    clinicName,
    topServices: (procedures ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.name),
    })),
    hoursText: hoursMatch?.[1]?.trim() ?? "",
    address: addressMatch?.[1]?.trim() ?? null,
  };

  clinicSummaryCache.set(clinicId, { at: Date.now(), summary });
  return summary;
}

export async function loadConversationHistory(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 10
): Promise<HistoryMessage[]> {
  const { data: rows } = await supabase
    .from("whatsapp_messages")
    .select("direction, content, sent_at, ai_processed_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(limit * 2);

  return (rows ?? [])
    .reverse()
    .filter((m) => {
      const content = String(m.content ?? "").trim();
      if (!content) return false;
      if (m.direction === "inbound") return Boolean(m.ai_processed_at);
      return true;
    })
    .slice(-limit)
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: String(m.content ?? ""),
      sentAt: m.sent_at ? String(m.sent_at) : undefined,
    }));
}

export class ContextBuilder {
  constructor(private readonly supabase: SupabaseClient) {}

  async build(opts: {
    conversation: Conversation;
    config: ClinicConfig;
    message: string;
    phoneNumber: string;
    turnId: string;
    aiState?: AiConversationState;
    history?: HistoryMessage[];
  }): Promise<TurnContext> {
    const history =
      opts.history ??
      (await loadConversationHistory(this.supabase, opts.conversation.id));

    const [clinicSummary, journey] = await Promise.all([
      loadClinicSummary(this.supabase, opts.conversation.clinicId),
      loadContactJourneyForAi(this.supabase, {
        clinicId: opts.conversation.clinicId,
        phone: opts.phoneNumber,
      }).catch(() => null),
    ]);

    return {
      conversation: opts.conversation,
      config: opts.config,
      message: opts.message,
      phoneNumber: opts.phoneNumber,
      turnId: opts.turnId,
      history,
      operationalMemory: operationalFromAiState(opts.aiState),
      clinicSummary,
      patientJourney: journey?.summary ?? undefined,
    };
  }
}
