import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationState } from "./types";
import { logAiEvent } from "./event-log";
import { getCheckpointer } from "./langgraph/checkpointer";

export interface ClearConversationContextResult {
  conversationId: string;
  hadAiState: boolean;
  reactivated: boolean;
}

/**
 * Limpa o contexto da IA de uma conversa (ai_state, debounce, checkpoint LangGraph).
 * Mantém histórico de mensagens WhatsApp. Reativa a IA por padrão.
 */
export async function clearConversationContext(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  opts?: { reactivate?: boolean }
): Promise<ClearConversationContextResult> {
  const reactivate = opts?.reactivate !== false;

  const { data: conv, error: fetchErr } = await supabase
    .from("whatsapp_conversations")
    .select("id, ai_state, ai_handoff_at, ai_enabled, phone_number")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (fetchErr || !conv) {
    throw new Error(fetchErr?.message ?? "Conversa não encontrada");
  }

  const prevState = (conv.ai_state ?? {}) as AiConversationState;
  const hadAiState = Object.keys(prevState).length > 0;

  const updatePayload: Record<string, unknown> = {
    ai_state: {},
    ai_debounce_until: null,
  };

  if (reactivate) {
    updatePayload.ai_handoff_at = null;
    updatePayload.ai_enabled = true;
    updatePayload.ai_user_opt_out = false;
  }

  const { error: updateErr } = await supabase
    .from("whatsapp_conversations")
    .update(updatePayload)
    .eq("id", conversationId);

  if (updateErr) throw new Error(updateErr.message);

  try {
    const checkpointer = await getCheckpointer();
    if (checkpointer && typeof checkpointer.deleteThread === "function") {
      await checkpointer.deleteThread(conversationId);
    }
  } catch (e) {
    console.warn("[clearConversationContext] checkpoint clear failed:", e);
  }

  logAiEvent(supabase, {
    clinicId,
    conversationId,
    stage: "context_cleared",
    detail: {
      source: "admin",
      hadAiState,
      reactivated: reactivate,
      previousStateSummary: {
        intent: prevState.intent ?? null,
        booking_step: prevState.booking_step ?? null,
        offered_slots_count: prevState.offered_slots?.length ?? 0,
        offered_days_count: prevState.offered_days?.length ?? 0,
        pipeline_stage: prevState.pipeline_stage ?? null,
        had_handoff: Boolean(conv.ai_handoff_at),
      },
      phone: conv.phone_number,
    },
  });

  return { conversationId, hadAiState, reactivated: reactivate };
}
