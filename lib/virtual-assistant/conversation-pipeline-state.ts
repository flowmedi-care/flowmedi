import type { SupabaseClient } from "@supabase/supabase-js";
import { CRM_TRANSITIONS } from "./agent-pipeline/flow-model";
import { resolveParallelStages } from "./agent-pipeline/resolver";
import { AGENT_PIPELINE_STAGE_MAP, type AgentPipelineStage } from "./agent-pipeline/stages";
import { deriveRuntimeStage } from "./conversation-state/derive-runtime-stage";
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

type StageEnterEventDetail = {
  from_stage?: string | null;
  to_stage?: string;
  trigger?: string;
};

function isAgentPipelineStage(value: unknown): value is AgentPipelineStage {
  return typeof value === "string" && AGENT_PIPELINE_STAGE_MAP.has(value as AgentPipelineStage);
}

export function buildStageHistoryFromEvents(
  events: { created_at: string; detail: unknown }[]
): PipelineStageHistoryEntry[] {
  const history: PipelineStageHistoryEntry[] = [];

  for (const ev of events) {
    const detail = ev.detail as StageEnterEventDetail | null;
    const toStage = detail?.to_stage;
    if (!isAgentPipelineStage(toStage)) continue;

    const fromRaw = detail?.from_stage;
    history.push({
      stage: toStage,
      enteredAt: ev.created_at,
      fromStage: isAgentPipelineStage(fromRaw) ? fromRaw : undefined,
      trigger: typeof detail?.trigger === "string" ? detail.trigger : undefined,
    });
  }

  return history;
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

  if (currentStage && !seen.has(currentStage)) {
    ordered.push(currentStage);
  }

  return ordered;
}

/** Maps stage history transitions to CRM edge ids in unified-flow-graph. */
export function mapHistoryToCrmEdgeIds(history: PipelineStageHistoryEntry[]): string[] {
  const ids: string[] = [];

  for (const entry of history) {
    if (!entry.fromStage) continue;
    const match = CRM_TRANSITIONS.find((t) => t.from === entry.fromStage && t.to === entry.stage);
    if (match) ids.push(match.id);
  }

  return ids;
}

export async function fetchConversationPipelineState(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string
): Promise<ConversationPipelineState | null> {
  const { data: conv, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone_number, contact_name, ai_state")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (convError || !conv) return null;

  const aiState = (conv.ai_state ?? {}) as AiConversationState;
  const derivedStage = deriveRuntimeStage({
    aiState,
    detectedIntent: "unknown",
  });
  const currentStage = isAgentPipelineStage(derivedStage) ? derivedStage : null;
  const currentStageEnteredAt = aiState.pipeline_stage_entered_at ?? null;

  const [{ data: events }, { data: toolLogs }] = await Promise.all([
    supabase
      .from("whatsapp_ai_event_log")
      .select("created_at, detail")
      .eq("clinic_id", clinicId)
      .eq("conversation_id", conversationId)
      .eq("stage", "pipeline_stage_enter")
      .order("created_at", { ascending: true }),
    supabase
      .from("whatsapp_ai_tool_log")
      .select("tool_name")
      .eq("clinic_id", clinicId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const stageHistory = buildStageHistoryFromEvents(events ?? []);

  if (stageHistory.length === 0 && currentStage && currentStageEnteredAt) {
    stageHistory.push({
      stage: currentStage,
      enteredAt: currentStageEnteredAt,
    });
  }

  const allVisited = deriveVisitedStages(stageHistory, currentStage);
  const visitedStages = currentStage
    ? allVisited.filter((s) => s !== currentStage)
    : allVisited.slice(0, -1);

  const parallelStages = resolveParallelStages(currentStage ?? "captacao", null, "unknown");

  return {
    conversationId: conv.id,
    phoneNumber: conv.phone_number,
    contactName: conv.contact_name,
    currentStage,
    currentStageEnteredAt,
    parallelStages,
    visitedStages,
    stageHistory,
    lastToolName: toolLogs?.[0]?.tool_name ?? null,
  };
}
