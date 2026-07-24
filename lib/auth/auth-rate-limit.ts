/**
 * In-memory rate limit + progressive throttle for auth endpoints.
 * Same multi-instance limitation as lib/public-site/rate-limit.ts.
 */

type CountWindow = { count: number; resetAt: number };
type ThrottleState = { failures: number; nextAllowedAt: number };

const rateHits = new Map<string, CountWindow>();
const throttleHits = new Map<string, ThrottleState>();

const THROTTLE_DELAYS_MS = [0, 500, 1000, 2000, 4000] as const;

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateHits.get(key);

  if (!entry || now > entry.resetAt) {
    rateHits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= maxRequests) {
    return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }

  entry.count += 1;
  return { ok: true };
}

/** Progressive throttle without sleeping the worker. */
export function getThrottleGate(key: string): {
  allowed: boolean;
  retryAfterMs: number;
  failures: number;
} {
  const now = Date.now();
  const state = throttleHits.get(key);
  if (!state) {
    return { allowed: true, retryAfterMs: 0, failures: 0 };
  }
  if (now < state.nextAllowedAt) {
    return {
      allowed: false,
      retryAfterMs: state.nextAllowedAt - now,
      failures: state.failures,
    };
  }
  return { allowed: true, retryAfterMs: 0, failures: state.failures };
}

export function recordAuthFailure(key: string): { failures: number; nextAllowedAt: number } {
  const now = Date.now();
  const prev = throttleHits.get(key);
  const failures = (prev?.failures ?? 0) + 1;
  const delayIdx = Math.min(failures - 1, THROTTLE_DELAYS_MS.length - 1);
  const delay = THROTTLE_DELAYS_MS[delayIdx] ?? 4000;
  const nextAllowedAt = now + delay;
  throttleHits.set(key, { failures, nextAllowedAt });
  return { failures, nextAllowedAt };
}

export function clearAuthFailures(key: string): void {
  throttleHits.delete(key);
}

/** True after ≥1 failure in the current throttle window for this key. */
export function requiresCaptchaForKey(key: string): boolean {
  const state = throttleHits.get(key);
  return Boolean(state && state.failures >= 1);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
