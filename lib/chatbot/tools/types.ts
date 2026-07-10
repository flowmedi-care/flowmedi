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

export type ToolResult<T = unknown> = {
  status: "success" | "missing" | "ambiguous" | "unavailable" | "error";
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

export function missingResult(
  fields: string[] | MissingField[],
  message: string
): ToolResult {
  const missing: MissingField[] = fields.map((f) =>
    typeof f === "string" ? { field: f } : f
  );
  return { status: "missing", missing, message };
}

export function ambiguousResult(
  message: string,
  options: ToolOption[]
): ToolResult {
  return { status: "ambiguous", message, options };
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
export function isRecoverableToolStatus(status: ToolResult["status"]): boolean {
  return (
    status === "success" ||
    status === "missing" ||
    status === "ambiguous" ||
    status === "unavailable"
  );
}

export function legacyErrorToResult(raw: Record<string, unknown>): ToolResult {
  if (raw.error) {
    const missing = raw.missing;
    if (Array.isArray(missing) && missing.length) {
      return {
        status: "missing",
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
