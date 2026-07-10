import type { Intent } from "../shared/intent";
import type { Timestamp } from "../shared/timestamp";

export type ConsentStatus = "unknown" | "granted" | "denied";

export type ConsentRecord = {
  status: ConsentStatus;
  deferredIntent: Intent | null;
  recordedAt: Timestamp | null;
};

export function emptyConsentRecord(): ConsentRecord {
  return {
    status: "unknown",
    deferredIntent: null,
    recordedAt: null,
  };
}

export function grantedConsentRecord(recordedAt: Timestamp): ConsentRecord {
  return {
    status: "granted",
    deferredIntent: null,
    recordedAt,
  };
}

export function deniedConsentRecord(recordedAt: Timestamp): ConsentRecord {
  return {
    status: "denied",
    deferredIntent: null,
    recordedAt,
  };
}

export function consentWithDeferredIntent(intent: Intent): ConsentRecord {
  return {
    status: "unknown",
    deferredIntent: intent,
    recordedAt: null,
  };
}
