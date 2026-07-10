export { runChatbotTurn, runTurn } from "./agent/runtime";
export type { RunTurnInput, RunTurnResult, HistoryMessage } from "./agent/runtime";
export { buildSystemPrompt } from "./agent/prompt";
export type { ClinicContext } from "./agent/prompt";
export { CHATBOT_TOOLS, CHATBOT_TOOL_NAMES, executeTool } from "./tools/registry";
export type { ToolResult, ToolContext, FaqItem } from "./tools/registry";
export { normalizeAiState, serializeAiState } from "./state/migrate";
export type { AiState, BookingState, OfferedSlot, OfferedOption, OfferedDay } from "./state/types";
export { initialAiState, isActiveBooking } from "./state/types";
export { validateToolCall } from "./guardrails/validators";
export { applyReplyGuards } from "./guardrails/reply-guards";
export {
  tryAcquireProcessingLock,
  releaseProcessingLock,
  shouldSkipDuplicateReply,
  isProcessingLockActive,
} from "./infra/lock";
