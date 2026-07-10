import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";

export type ClinicConfig = {
  clinicId: string;
  assistantName: string;
  requiresConsentForMessaging: boolean;
  llmDisabled: boolean;
  humanHandoffEnabled: boolean;
  faqs: Array<{ id: string; question: string; answer: string }>;
};

export function clinicConfigFromSettings(
  clinicId: string,
  settings: Partial<VirtualAssistantSettings>,
  faqs: Array<{ id: string; question: string; answer: string }> = []
): ClinicConfig {
  return {
    clinicId,
    assistantName: settings.assistant_name?.trim() || "Assistente",
    requiresConsentForMessaging: true,
    llmDisabled: false,
    humanHandoffEnabled: settings.human_handoff_enabled !== false,
    faqs,
  };
}
