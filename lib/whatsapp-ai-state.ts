export type ConversationHandler = "ai" | "human";

export type ConversationAiFields = {
  ai_enabled: boolean | null;
  ai_handoff_at: string | null;
  ai_user_opt_out: boolean | null;
};

/** Same rule as process-inbound.ts and process-whatsapp-ai cron. */
export function isAiHandling(conv: ConversationAiFields): boolean {
  return (
    !conv.ai_user_opt_out &&
    !conv.ai_handoff_at &&
    conv.ai_enabled !== false
  );
}

export function getConversationHandler(conv: ConversationAiFields): ConversationHandler {
  return isAiHandling(conv) ? "ai" : "human";
}

export type HandlerFilter = "all" | "ai" | "human";

export const WHATSAPP_HANDLER_FILTER_STORAGE_KEY = "whatsapp-handler-filter";

export function isValidHandlerFilter(value: string | null): value is HandlerFilter {
  return value === "all" || value === "ai" || value === "human";
}
