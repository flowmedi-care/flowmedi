function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isClinicalStreamingEnabled(): boolean {
  return envFlag("CLINICAL_STREAMING_TRANSCRIPTION_ENABLED", false);
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
