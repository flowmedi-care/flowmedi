const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const TIMEOUT_MS = 5_000;

export type RecaptchaVerifyResult =
  | { ok: true }
  | { ok: false; reason: "CAPTCHA_INVALID" | "CAPTCHA_UNAVAILABLE" };

function expectedHostnames(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).hostname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  // Common production aliases
  hosts.add("flowmed.app");
  hosts.add("www.flowmed.app");
  return hosts;
}

/**
 * Verifies a Google reCAPTCHA v2 token with timeout + hostname check.
 */
export async function verifyRecaptchaToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<RecaptchaVerifyResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error("[recaptcha] RECAPTCHA_SECRET_KEY is not configured");
    return { ok: false, reason: "CAPTCHA_UNAVAILABLE" };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return { ok: false, reason: "CAPTCHA_INVALID" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (remoteIp && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, reason: "CAPTCHA_UNAVAILABLE" };
    }

    const data = (await res.json()) as {
      success?: boolean;
      hostname?: string;
      "error-codes"?: string[];
    };

    if (!data.success) {
      return { ok: false, reason: "CAPTCHA_INVALID" };
    }

    const hostname = (data.hostname ?? "").toLowerCase();
    if (!hostname || !expectedHostnames().has(hostname)) {
      console.warn("[recaptcha] unexpected hostname:", hostname);
      return { ok: false, reason: "CAPTCHA_INVALID" };
    }

    return { ok: true };
  } catch (err) {
    console.error("[recaptcha] siteverify failed", err);
    return { ok: false, reason: "CAPTCHA_UNAVAILABLE" };
  }
}
