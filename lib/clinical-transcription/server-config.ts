import {
  isClinicalStreamingEnabled,
  isClinicalStreamingFallbackToBatch,
} from "@/lib/clinical-transcription/feature-flags";

export function getClinicalStreamingServerConfig() {
  return {
    streamingEnabled: isClinicalStreamingEnabled(),
    fallbackToBatch: isClinicalStreamingFallbackToBatch(),
  };
}
