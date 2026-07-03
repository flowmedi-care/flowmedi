import {
  getClinicalStreamingMode,
  isClinicalStreamingEnabled,
  isClinicalStreamingFallbackToBatch,
} from "@/lib/clinical-transcription/feature-flags";

export function getClinicalStreamingServerConfig() {
  const streamingMode = getClinicalStreamingMode();
  return {
    streamingMode,
    streamingEnabled: isClinicalStreamingEnabled(),
    hybridEnabled: streamingMode === "hybrid",
    realtimeEnabled: streamingMode === "realtime",
    fallbackToBatch: isClinicalStreamingFallbackToBatch(),
  };
}
