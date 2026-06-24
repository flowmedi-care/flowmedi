import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationState } from "./types";
import { logAiEvent } from "./event-log";

export interface ClearAssistantQueueResult {
  messagesSkipped: number;
  conversationsReset: number;
  transcriptionJobsCleared: number;
}

/**
 * Descarta a fila da IA sem enviar respostas: marca mensagens antigas como processadas,
 * limpa debounce, jobs de transcrição e estado de contexto da IA nas conversas.
 */
export async function clearAssistantQueue(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClearAssistantQueueResult> {
  const now = new Date().toISOString();

  const { count: pendingCount, error: countErr } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null);

  if (countErr) throw new Error(countErr.message);

  const { error: msgErr } = await supabase
    .from("whatsapp_messages")
    .update({ ai_processed_at: now })
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null);

  if (msgErr) throw new Error(msgErr.message);

  const { data: justCleared } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id")
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .eq("ai_processed_at", now);

  const clearedByConversation = new Map<string, number>();
  for (const row of justCleared ?? []) {
    if (!row.conversation_id) continue;
    clearedByConversation.set(
      row.conversation_id,
      (clearedByConversation.get(row.conversation_id) ?? 0) + 1
    );
  }

  for (const [conversationId, count] of clearedByConversation) {
    logAiEvent(supabase, {
      clinicId,
      conversationId,
      stage: "flow_discarded",
      level: "info",
      detail: {
        reason: "Fila zerada manualmente — sem resposta da IA",
        source: "clear_queue",
        messagesDiscarded: count,
      },
    });
  }

  const { data: convs, error: convFetchErr } = await supabase
    .from("whatsapp_conversations")
    .select("id, ai_state")
    .eq("clinic_id", clinicId);

  if (convFetchErr) throw new Error(convFetchErr.message);

  let transcriptionJobsCleared = 0;
  for (const c of convs ?? []) {
    const jobs = (c.ai_state as AiConversationState | null)?.pending_transcription_jobs;
    if (Array.isArray(jobs)) transcriptionJobsCleared += jobs.length;
  }

  const { error: convErr } = await supabase
    .from("whatsapp_conversations")
    .update({
      ai_debounce_until: null,
      ai_state: {},
    })
    .eq("clinic_id", clinicId);

  if (convErr) throw new Error(convErr.message);

  return {
    messagesSkipped: pendingCount ?? 0,
    conversationsReset: convs?.length ?? 0,
    transcriptionJobsCleared,
  };
}
