import { SPAM_COOLDOWN_MS } from "@/lib/public-suggestions";

const ipCooldownMap = new Map<string, number>();

export function checkSuggestionSpamCooldown(clientKey: string, now = Date.now()) {
  const last = ipCooldownMap.get(clientKey);
  if (!last) {
    ipCooldownMap.set(clientKey, now);
    return { allowed: true, retryAfterMs: 0 };
  }

  const elapsed = now - last;
  if (elapsed < SPAM_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterMs: SPAM_COOLDOWN_MS - elapsed,
    };
  }

  ipCooldownMap.set(clientKey, now);
  return { allowed: true, retryAfterMs: 0 };
}
