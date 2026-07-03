function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export type ClinicalStreamingMode = "off" | "hybrid" | "realtime";

export function isClinicalStreamingEnabled(): boolean {
  return getClinicalStreamingMode() !== "off";
}

/** hybrid = prévia no navegador + Whisper batch ao parar (padrão). realtime = WebSocket VPS. */
export function getClinicalStreamingMode(): ClinicalStreamingMode {
  if (!envFlag("CLINICAL_STREAMING_TRANSCRIPTION_ENABLED", false)) {
    return "off";
  }
  const raw = process.env.CLINICAL_STREAMING_MODE?.trim().toLowerCase();
  if (raw === "realtime" || raw === "websocket" || raw === "stream") {
    return "realtime";
  }
  return "hybrid";
}

export function isClinicalStreamingFallbackToBatch(): boolean {
  return envFlag("CLINICAL_STREAMING_FALLBACK_TO_BATCH", true);
}

export function isClinicalPostProcessingEnabled(): boolean {
  return envFlag("CLINICAL_TRANSCRIPTION_POST_PROCESSING_ENABLED", true);
}

export function shouldStoreClinicalAudio(): boolean {
  return envFlag("CLINICAL_TRANSCRIPTION_STORE_AUDIO", false);
}

export function getOpenAiClinicalModel(): string {
  return process.env.OPENAI_CLINICAL_MODEL?.trim() || "gpt-4o";
}
