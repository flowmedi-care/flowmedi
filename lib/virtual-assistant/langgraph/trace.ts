import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "../event-log";
import type { AgentPipelineStage } from "../agent-pipeline/stages";
import type { InboundIntent } from "../detect-inbound-intent";

export type ReplySource =
  | "subgraph"
  | "tool_loop"
  | "compose_llm"
  | "fallback"
  | "deterministic"
  | "continuity";

export type LangGraphTraceDetail = {
  node: string;
  detected_intent?: InboundIntent;
  intent_confidence?: number;
  used_llm?: boolean;
  pipeline_stage?: AgentPipelineStage;
  routed_flow?: string;
  patient_id_present?: boolean;
  stage_subgraph?: AgentPipelineStage;
  subgraph_had_reply?: boolean;
  needs_tool_loop?: boolean;
  handled?: boolean;
  continuity_intent?: InboundIntent;
  compose_invoked?: boolean;
  reply_source?: ReplySource;
  had_reply_before_compose?: boolean;
  compose_skipped?: boolean;
  inbound_preview?: string;
  reply_preview?: string;
};

export function logLangGraphTrace(
  supabase: SupabaseClient | null | undefined,
  clinicId: string,
  conversationId: string | undefined,
  detail: LangGraphTraceDetail
): void {
  if (!supabase) return;
  logAiEvent(supabase, {
    clinicId,
    conversationId,
    stage: "langgraph_trace",
    detail: detail as Record<string, unknown>,
  });
}

export const CAPTACAO_GREETING_MENU =
  "Olá! Posso ajudar com:\n1. Agendar consulta\n2. Valores e procedimentos\n3. Falar com a equipe\n\nO que você precisa?";
