import type { ToolDefinition } from "../openai-client";
import { ASSISTANT_TOOLS } from "../tools/definitions";

/** Ferramentas permitidas no assistente simplificado (MVP). */
export const SIMPLE_ASSISTANT_TOOL_NAMES = [
  "lookup_patient_by_phone",
  "register_patient",
  "list_procedures",
  "list_doctors",
  "find_available_slots",
  "create_appointment",
  "get_service_price",
  "list_price_options",
  "list_services",
  "transfer_to_human",
] as const;

export type SimpleAssistantToolName = (typeof SIMPLE_ASSISTANT_TOOL_NAMES)[number];

const SIMPLE_SET = new Set<string>(SIMPLE_ASSISTANT_TOOL_NAMES);

export function filterSimpleAssistantTools(): ToolDefinition[] {
  return ASSISTANT_TOOLS.filter((t) => SIMPLE_SET.has(t.function.name));
}

export function isSimpleAssistantTool(name: string): boolean {
  return SIMPLE_SET.has(name);
}

export const PRICING_TOOL_NAMES = [
  "list_procedures",
  "list_services",
  "get_service_price",
  "list_price_options",
] as const;

export function filterPricingTools(): ToolDefinition[] {
  const allowed = new Set<string>(PRICING_TOOL_NAMES);
  return ASSISTANT_TOOLS.filter((t) => allowed.has(t.function.name));
}
