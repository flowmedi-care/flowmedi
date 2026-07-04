import type { AiConversationState } from "../types";
import { ASSISTANT_TOOL_CATALOG } from "../tools/catalog";
import { MUTATING_TOOL_NAMES } from "./constants";

export type ToolExecutionMode = "auto" | "human_confirm";

export type ToolExecutionModesConfig = Record<string, ToolExecutionMode>;

const DEFAULT_MODE: ToolExecutionMode = "auto";

/** Modo padrão: automático, exceto cancelamento (ação irreversível). */
export function buildDefaultToolExecutionModes(): ToolExecutionModesConfig {
  const modes: ToolExecutionModesConfig = {};
  for (const name of MUTATING_TOOL_NAMES) {
    modes[name] = DEFAULT_MODE;
  }
  modes.cancel_appointment = "human_confirm";
  for (const entry of ASSISTANT_TOOL_CATALOG) {
    if (!modes[entry.name]) modes[entry.name] = DEFAULT_MODE;
  }
  return modes;
}

export function mergeToolExecutionModes(
  stored: ToolExecutionModesConfig | null | undefined
): ToolExecutionModesConfig {
  return { ...buildDefaultToolExecutionModes(), ...(stored ?? {}) };
}

export function getToolExecutionMode(
  toolName: string,
  config: ToolExecutionModesConfig | null | undefined
): ToolExecutionMode {
  const merged = mergeToolExecutionModes(config);
  return merged[toolName] ?? DEFAULT_MODE;
}

export function requiresHumanConfirm(
  toolName: string,
  config: ToolExecutionModesConfig | null | undefined
): boolean {
  return getToolExecutionMode(toolName, config) === "human_confirm";
}

export type PendingToolConfirmation = {
  tool: string;
  args: Record<string, unknown>;
  expires_at: string;
  prompt_message?: string;
};

export function buildConfirmationPrompt(
  toolName: string,
  args: Record<string, unknown>
): string {
  const catalog = ASSISTANT_TOOL_CATALOG.find((t) => t.name === toolName);
  const label = catalog?.label ?? toolName;

  switch (toolName) {
    case "cancel_appointment":
      return "Posso cancelar sua consulta. Confirma? Responda *sim* para confirmar ou *não* para manter.";
    case "create_appointment":
      return "Posso confirmar este agendamento. Responda *sim* para confirmar ou *não* para escolher outro horário.";
    case "create_and_send_quote":
      return "Posso gerar e enviar o orçamento agora. Responda *sim* para confirmar ou *não* para ajustar.";
    case "reschedule_appointment":
      return `Posso remarcar sua consulta. Responda *sim* para confirmar ou *não* para cancelar.`;
    default:
      return `Posso executar: ${label}. Responda *sim* para confirmar ou *não* para cancelar.`;
  }
}

export function parseToolConfirmationReply(text: string): "yes" | "no" | null {
  const t = text.trim().toLowerCase();
  if (/^(sim|s|ok|confirmo|pode|yes|confirmar)\b/.test(t)) return "yes";
  if (/^(n[aã]o|nao|cancelar|cancela|n\b)/.test(t)) return "no";
  return null;
}

export function isPendingToolConfirmationExpired(
  pending: PendingToolConfirmation | undefined
): boolean {
  if (!pending?.expires_at) return true;
  return new Date(pending.expires_at).getTime() < Date.now();
}

export function createPendingToolConfirmation(
  toolName: string,
  args: Record<string, unknown>,
  ttlMinutes = 30
): PendingToolConfirmation {
  return {
    tool: toolName,
    args,
    expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    prompt_message: buildConfirmationPrompt(toolName, args),
  };
}

export type ToolExecutionModesRow = {
  tool_execution_modes?: ToolExecutionModesConfig | null;
};

export function extractToolExecutionModesFromSettings(
  settings: ToolExecutionModesRow | null | undefined
): ToolExecutionModesConfig {
  return mergeToolExecutionModes(settings?.tool_execution_modes ?? undefined);
}
