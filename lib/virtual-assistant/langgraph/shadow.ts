import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "../event-log";
import { runVirtualAssistantAgent } from "../agent";
import type { AiConversationState, VirtualAssistantSettings } from "../types";
import type { GraphHistoryMessage } from "./state";
import { runLangGraphAssistant } from "./run";

export async function runShadowLangGraphComparison(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userMessages: string[];
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  history: GraphHistoryMessage[];
  legacyResult: { reply: string; handoff?: boolean; statePatch?: Partial<AiConversationState> };
}): Promise<void> {
  try {
    const lgResult = await runLangGraphAssistant({
      supabase: opts.supabase,
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      userMessages: opts.userMessages,
      settings: opts.settings,
      aiState: opts.aiState,
      history: opts.history,
    });

    logAiEvent(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      stage: "langgraph_shadow_compare",
      detail: {
        legacy_reply_preview: opts.legacyResult.reply.slice(0, 200),
        langgraph_reply_preview: lgResult.reply.slice(0, 200),
        legacy_handoff: opts.legacyResult.handoff ?? false,
        langgraph_handoff: lgResult.handoff ?? false,
        legacy_stage: opts.legacyResult.statePatch?.pipeline_stage,
        langgraph_stage: lgResult.statePatch?.pipeline_stage,
      },
    });
  } catch (e) {
    logAiEvent(opts.supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      stage: "langgraph_shadow_error",
      level: "warn",
      detail: { message: e instanceof Error ? e.message : String(e) },
    });
  }
}

export async function runAssistantWithOptionalShadow(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userMessages: string[];
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  history: GraphHistoryMessage[];
}): Promise<{ reply: string; handoff?: boolean; statePatch?: Partial<AiConversationState> }> {
  const useLangGraph = Boolean(opts.settings.use_langgraph_pipeline);
  const shadowMode = Boolean(opts.settings.langgraph_shadow_mode);

  if (useLangGraph) {
    return runLangGraphAssistant(opts);
  }

  const legacyResult = await runVirtualAssistantAgent(opts);

  if (shadowMode) {
    void runShadowLangGraphComparison({ ...opts, legacyResult });
  }

  return legacyResult;
}
