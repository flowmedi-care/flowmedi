import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { AiState } from "../state/types";

export type ToolResult<T = unknown> =
  | { status: "success"; data: T }
  | { status: "missing"; missing: string[]; hint: string }
  | { status: "validation_error"; error: string; hint?: string }
  | { status: "domain_error"; error: string; hint?: string };

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

export function successResult<T>(data: T): ToolResult<T> {
  return { status: "success", data };
}

export function missingResult(missing: string[], hint: string): ToolResult {
  return { status: "missing", missing, hint };
}

export function domainError(error: string, hint?: string): ToolResult {
  return { status: "domain_error", error, hint };
}

export function validationError(error: string, hint?: string): ToolResult {
  return { status: "validation_error", error, hint };
}

export function legacyErrorToResult(raw: Record<string, unknown>): ToolResult {
  if (raw.error) {
    const missing = raw.missing;
    if (Array.isArray(missing) && missing.length) {
      return {
        status: "missing",
        missing: missing.map(String),
        hint: String(raw.hint ?? raw.error),
      };
    }
    return {
      status: "domain_error",
      error: String(raw.error),
      hint: raw.hint ? String(raw.hint) : undefined,
    };
  }
  return { status: "success", data: raw };
}
