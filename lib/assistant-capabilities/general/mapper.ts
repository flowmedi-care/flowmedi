import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { generalDefaults } from "./defaults";
import type { GeneralSettings } from "./types";

export function vaSettingsToGeneral(
  settings: Partial<VirtualAssistantSettings>
): GeneralSettings {
  const d = generalDefaults();
  return {
    enabled: settings.enabled === true,
    assistantName: settings.assistant_name?.trim() || d.assistantName,
    tone: settings.tone === "formal" ? "formal" : "informal",
    useEmojis: settings.use_emojis !== false,
    transferToHuman: settings.human_handoff_enabled !== false,
    avgWaitTime: settings.avg_wait_time ?? d.avgWaitTime,
    botActiveStart: String(settings.bot_active_start ?? d.botActiveStart).slice(0, 5),
    botActiveEnd: String(settings.bot_active_end ?? d.botActiveEnd).slice(0, 5),
    debounceSeconds: settings.message_debounce_seconds ?? d.debounceSeconds,
  };
}

export function generalToVaPatch(
  value: GeneralSettings
): Partial<VirtualAssistantSettings> {
  return {
    enabled: value.enabled,
    assistant_name: value.assistantName.trim() || "Assistente",
    tone: value.tone,
    use_emojis: value.useEmojis,
    human_handoff_enabled: value.transferToHuman,
    avg_wait_time: value.avgWaitTime.trim() || null,
    bot_active_start: value.botActiveStart,
    bot_active_end: value.botActiveEnd,
    message_debounce_seconds: value.debounceSeconds,
  };
}
