import type { GeneralSettings } from "./types";

export function generalDefaults(): GeneralSettings {
  return {
    enabled: false,
    assistantName: "Assistente",
    tone: "informal",
    useEmojis: true,
    transferToHuman: true,
    avgWaitTime: "",
    botActiveStart: "08:00",
    botActiveEnd: "20:00",
    debounceSeconds: 5,
  };
}
