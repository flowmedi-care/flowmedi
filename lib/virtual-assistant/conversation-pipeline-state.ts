import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAiState } from "@/lib/chatbot/state/migrate";
import type { AgentPipelineStage } from "./agent-pipeline/stages";
import type { AiConversationState } from "./types";

export type PipelineStageHistoryEntry = {
  stage: AgentPipelineStage;
  enteredAt: string;
  fromStage?: AgentPipelineStage;
  trigger?: string;
};

export type ConversationPipelineState = {
  conversationId: string;
  phoneNumber: string;
  contactName: string | null;
  currentStage: AgentPipelineStage | null;
  currentStageEnteredAt: string | null;
  parallelStages: AgentPipelineStage[];
  visitedStages: AgentPipelineStage[];
  stageHistory: PipelineStageHistoryEntry[];
  lastToolName: string | null;
};

function deriveAnalyticsStage(aiState: AiConversationState): AgentPipelineStage | null {
  if (aiState.booking?.status === "done") return "agendamento";
  if (aiState.booking) return "agendamento";
  if (aiState.patient_id) return "captacao";
  return "identificacao";
}

export function buildStageHistoryFromEvents(
  events: { created_at: string; detail: unknown }[]
): PipelineStageHistoryEntry[] {
  return events
    .map((ev) => {
      const detail = ev.detail as { to_stage?: string; from_stage?: string; trigger?: string } | null;
      const stage = detail?.to_stage as AgentPipelineStage | undefined;
      if (!stage) return null;
      return {
        stage,
        enteredAt: ev.created_at,
        fromStage: detail?.from_stage as AgentPipelineStage | undefined,
        trigger: detail?.trigger,
      };
    })
    .filter(Boolean) as PipelineStageHistoryEntry[];
}

export function deriveVisitedStages(
  history: PipelineStageHistoryEntry[],
  currentStage: AgentPipelineStage | null
): AgentPipelineStage[] {
  const seen = new Set<AgentPipelineStage>();
  const ordered: AgentPipelineStage[] = [];
  for (const entry of history) {
    if (seen.has(entry.stage)) continue;
    seen.add(entry.stage);
    ordered.push(entry.stage);
  }
  if (currentStage && !seen.has(currentStage)) ordered.push(currentStage);
  return ordered;
}

export function mapHistoryToCrmEdgeIds(_history: PipelineStageHistoryEntry[]): string[] {
  return [];
}

export async function fetchConversationPipelineState(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<ConversationPipelineState | null> {
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone_number, contact_name, ai_state")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!conv) return null;

  const aiState = normalizeAiState(conv.ai_state as Record<string, unknown>);
  const currentStage = deriveAnalyticsStage(aiState);

  const { data: toolLog } = await supabase
    .from("whatsapp_ai_tool_log")
    .select("tool_name")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    conversationId,
    phoneNumber: String(conv.phone_number),
    contactName: conv.contact_name ? String(conv.contact_name) : null,
    currentStage,
    currentStageEnteredAt: null,
    parallelStages: [],
    visitedStages: currentStage ? [currentStage] : [],
    stageHistory: [],
    lastToolName: toolLog?.tool_name ? String(toolLog.tool_name) : null,
  };
}
