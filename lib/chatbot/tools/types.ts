import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { AiState } from "../state/types";

export type MissingField = {
  field: string;
  reason?: string;
};

export type ToolOption = {
  id: string;
  label: string;
  index?: number;
};

export type ToolResultStatus =
  | "success"
  | "needs_input"
  | "unavailable"
  | "not_found"
  | "error";

export type ToolResult<T = unknown> = {
  status: ToolResultStatus;
  data?: T;
  message?: string;
  missing?: MissingField[];
  options?: ToolOption[];
  suggestion?: string;
};

export type FaqItem = { id: string; question: string; answer: string };

export type ToolContext = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  aiState: AiState;
  settings: Partial<VirtualAssistantSettings>;
  faqs: FaqItem[];
};

export type ToolExecutionOutcome = {
  result: ToolResult;
  handoff?: boolean;
  statePatch?: Partial<AiState>;
};

export function toolResultToJson(result: ToolResult): string {
  return JSON.stringify(result);
}

export function successResult<T>(
  data: T,
  options?: ToolOption[]
): ToolResult<T> {
  const result: ToolResult<T> = { status: "success", data };
  if (options?.length) result.options = options;
  return result;
}

export function needsInputResult(
  fields: string[] | MissingField[],
  message: string,
  options?: ToolOption[]
): ToolResult {
  const missing: MissingField[] = fields.map((f) =>
    typeof f === "string" ? { field: f } : f
  );
  const result: ToolResult = { status: "needs_input", missing, message };
  if (options?.length) result.options = options;
  return result;
}

/** @deprecated Use needsInputResult */
export const missingResult = needsInputResult;

export function notFoundResult(message: string, suggestion?: string): ToolResult {
  return { status: "not_found", message, suggestion };
}

/** @deprecated Use needsInputResult with options */
export function ambiguousResult(
  message: string,
  options: ToolOption[]
): ToolResult {
  return needsInputResult([], message, options);
}

export function unavailableResult(
  message: string,
  suggestion?: string,
  data?: unknown
): ToolResult {
  return { status: "unavailable", message, suggestion, data };
}

export function errorResult(message: string, suggestion?: string): ToolResult {
  return { status: "error", message, suggestion };
}

/** Statuses that represent expected conversational flow, not system failures. */
export function isRecoverableToolStatus(status: ToolResultStatus): boolean {
  return (
    status === "success" ||
    status === "needs_input" ||
    status === "unavailable" ||
    status === "not_found"
  );
}

export function legacyErrorToResult(raw: Record<string, unknown>): ToolResult {
  if (raw.error) {
    const missing = raw.missing;
    if (Array.isArray(missing) && missing.length) {
      return {
        status: "needs_input",
        missing: missing.map((f) => ({ field: String(f) })),
        message: String(raw.hint ?? raw.error),
      };
    }
    return {
      status: "error",
      message: String(raw.error),
      suggestion: raw.hint ? String(raw.hint) : undefined,
    };
  }
  return { status: "success", data: raw };
}

/** Normalize legacy status strings from stored logs or tests. */
export function normalizeToolResultStatus(status: string): ToolResultStatus {
  if (status === "missing" || status === "ambiguous") return "needs_input";
  if (
    status === "success" ||
    status === "needs_input" ||
    status === "unavailable" ||
    status === "not_found" ||
    status === "error"
  ) {
    return status;
  }
  return "error";
}
