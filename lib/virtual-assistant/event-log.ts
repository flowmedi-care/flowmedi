import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_EVENT_STAGES = [
  "webhook_inbound",
  "routing_decision",
  "legacy_menu_no_reply",
  "debounce_scheduled",
  "processing_start",
  "pending_messages",
  "openai_start",
  "openai_end",
  "reply_sent",
  "confirmation_flow_handled",
  "handoff",
  "cron_batch_start",
  "cron_conversation_processed",
  "simulate_inbound",
  "ai_reactivated",
  "audio_transcribe_start",
  "audio_transcribe_ok",
  "audio_transcribe_failed",
  "audio_no_media",
  "queue_cleared",
  "flow_discarded",
  "error",
  "pipeline_stage_enter",
  "pipeline_stage_exit",
  "pipeline_tool_blocked",
  "pipeline_confirmation_pending",
  "langgraph_start",
  "langgraph_complete",
  "langgraph_trace",
  "agent_route",
  "langgraph_shadow_compare",
  "langgraph_shadow_error",
] as const;

export type AiEventStage = (typeof AI_EVENT_STAGES)[number];
export type AiEventLevel = "info" | "warn" | "error";

export interface LogAiEventInput {
  clinicId: string;
  conversationId?: string | null;
  messageId?: string | null;
  stage: AiEventStage;
  level?: AiEventLevel;
  detail?: Record<string, unknown>;
}

/**
 * Persiste evento de diagnóstico — fire-and-forget, não bloqueia o webhook.
 */
export function logAiEvent(
  supabase: SupabaseClient,
  input: LogAiEventInput
): void {
  const row = {
    clinic_id: input.clinicId,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    stage: input.stage,
    level: input.level ?? "info",
    detail: input.detail ?? {},
  };

  void supabase
    .from("whatsapp_ai_event_log")
    .insert(row)
    .then(({ error }) => {
      if (error) {
        console.warn("[VirtualAssistant] event log insert failed:", error.message, {
          stage: input.stage,
        });
      }
    });
}
