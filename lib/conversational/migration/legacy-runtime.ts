/**
 * Fase 4/5 — LangGraph desligado por padrão.
 * Defina LEGACY_RUNTIME_ENABLED=true para reativar o runtime LangGraph.
 */
export function isLegacyRuntimeDisabled(): boolean {
  return process.env.LEGACY_RUNTIME_ENABLED !== "true";
}

export const LEGACY_MODULES_MARKED_FOR_REMOVAL = [
  "lib/virtual-assistant/langgraph",
  "lib/virtual-assistant/agent-pipeline",
  "lib/virtual-assistant/simple",
] as const;
