/**
 * Fase 4 — desligamento do runtime legado (LangGraph).
 * Quando LEGACY_RUNTIME_DISABLED=true, process-inbound usa exclusivamente North Star.
 */
export function isLegacyRuntimeDisabled(): boolean {
  return process.env.LEGACY_RUNTIME_DISABLED === "true";
}

export const LEGACY_MODULES_MARKED_FOR_REMOVAL = [
  "lib/virtual-assistant/langgraph",
  "lib/virtual-assistant/agent-pipeline",
  "lib/virtual-assistant/simple",
] as const;
