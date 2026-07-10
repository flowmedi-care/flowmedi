import { MAX_CONSECUTIVE_TOOL_FAILURES } from "./constants";
import type { AiState } from "../state/types";

export function shouldEscalateOnToolFailures(state: AiState): boolean {
  return (state.consecutive_tool_failures ?? 0) >= MAX_CONSECUTIVE_TOOL_FAILURES;
}

export { MAX_CONSECUTIVE_TOOL_FAILURES };
