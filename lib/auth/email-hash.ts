import { createHash } from "crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** SHA-256 hex of normalized email — for auth security logs (no plaintext PII). */
export function hashEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}
