import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import { ConversationMapper } from "../infrastructure/persistence/conversation-mapper";
import type { ConversationSnapshot } from "../infrastructure/persistence/conversation-snapshot";
import type { Conversation } from "../domain/conversation/conversation";

/**
 * Dual-write: mantém snapshot North Star em ai_state enquanto legado convive.
 */
export function mergeLegacyAiStatePatch(
  aiState: AiConversationState,
  conversation: Conversation
): AiConversationState {
  const snapshot: ConversationSnapshot = ConversationMapper.toSnapshot(conversation);
  return {
    ...aiState,
    north_star_snapshot: snapshot,
    _north_star_version: snapshot.version,
  };
}

export async function writeDualStateToSupabase(
  supabase: SupabaseClient,
  conversationId: string,
  aiState: AiConversationState,
  conversation: Conversation
): Promise<{ error: Error | null }> {
  const merged = mergeLegacyAiStatePatch(aiState, conversation);
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ ai_state: merged })
    .eq("id", conversationId);
  return { error: error ? new Error(error.message) : null };
}
