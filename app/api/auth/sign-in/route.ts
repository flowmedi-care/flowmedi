import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { normalizeEmail, hashEmail } from "@/lib/auth/email-hash";
import {
  checkRateLimit,
  clearAuthFailures,
  getClientIp,
  getThrottleGate,
  recordAuthFailure,
  requiresCaptchaForKey,
} from "@/lib/auth/auth-rate-limit";
import { logAuthSecurityEvent } from "@/lib/auth/auth-security-log";
import { verifyRecaptchaToken } from "@/lib/auth/recaptcha";
import {
  resolvePostAuthRedirect,
  sanitizeRedirectPath,
} from "@/lib/auth/post-auth-redirect";
import { authUserExistsByEmail } from "@/lib/auth/user-exists";

const OPAQUE_AUTH_MESSAGE = "E-mail ou senha inválidos.";
const RATE_LIMIT_MESSAGE = "Muitas tentativas. Tente novamente em alguns minutos.";
const TEMP_ERROR_MESSAGE = "Não foi possível entrar agora. Tente novamente em instantes.";
const VALIDATION_MESSAGE = "Dados inválidos. Verifique e-mail e senha.";

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT_IP = 5;
const LIMIT_EMAIL = 5;
const LIMIT_IP_EMAIL = 10;

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

function jsonBody(
  status: number,
  body: {
    success: boolean;
    message?: string;
    redirect?: string;
    requireCaptcha: boolean;
  },
  extraHeaders?: HeadersInit
) {
  return NextResponse.json(body, { status, headers: extraHeaders });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonBody(400, {
      success: false,
      message: VALIDATION_MESSAGE,
      requireCaptcha: false,
    });
  }

  const emailRaw =
    typeof payload === "object" &&
    payload &&
    "email" in payload &&
    typeof (payload as { email: unknown }).email === "string"
      ? (payload as { email: string }).email
      : "";
  const password =
    typeof payload === "object" &&
    payload &&
    "password" in payload &&
    typeof (payload as { password: unknown }).password === "string"
      ? (payload as { password: string }).password
      : "";
  const captchaToken =
    typeof payload === "object" &&
    payload &&
    "captchaToken" in payload &&
    typeof (payload as { captchaToken: unknown }).captchaToken === "string"
      ? (payload as { captchaToken: string }).captchaToken
      : undefined;
  const redirectTo =
    typeof payload === "object" &&
    payload &&
    "redirectTo" in payload &&
    typeof (payload as { redirectTo: unknown }).redirectTo === "string"
      ? (payload as { redirectTo: string }).redirectTo
      : undefined;

  const email = normalizeEmail(emailRaw);
  const emailHash = email ? hashEmail(email) : null;

  if (!email || !password || !email.includes("@")) {
    return jsonBody(400, {
      success: false,
      message: VALIDATION_MESSAGE,
      requireCaptcha: false,
    });
  }

  const throttleKey = `auth-signin:${ip}:${email}`;
  const ipKey = `auth-signin-ip:${ip}`;
  const emailKey = `auth-signin-email:${email}`;
  const ipEmailKey = `auth-signin-ip-email:${ip}:${email}`;

  const requireCaptchaNow = () => requiresCaptchaForKey(throttleKey);

  // Throttle (timestamp gate — no sleep)
  const gate = getThrottleGate(throttleKey);
  if (!gate.allowed) {
    await logAuthSecurityEvent({
      event: "rate_limit",
      reason: "THROTTLE_EARLY",
      emailHash,
      ip,
      userAgent,
    });
    const headers: HeadersInit = {};
    if (gate.retryAfterMs > 0) {
      headers["Retry-After"] = String(Math.ceil(gate.retryAfterMs / 1000));
    }
    return jsonBody(
      429,
      {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        requireCaptcha: true,
      },
      headers
    );
  }

  // Rate limits (3 levels)
  const ipLimit = checkRateLimit(ipKey, LIMIT_IP, WINDOW_MS);
  if (!ipLimit.ok) {
    await logAuthSecurityEvent({
      event: "rate_limit",
      reason: "RATE_LIMIT_IP",
      emailHash,
      ip,
      userAgent,
    });
    return jsonBody(429, {
      success: false,
      message: RATE_LIMIT_MESSAGE,
      requireCaptcha: true,
    });
  }

  const emailLimit = checkRateLimit(emailKey, LIMIT_EMAIL, WINDOW_MS);
  if (!emailLimit.ok) {
    await logAuthSecurityEvent({
      event: "rate_limit",
      reason: "RATE_LIMIT_EMAIL",
      emailHash,
      ip,
      userAgent,
    });
    return jsonBody(429, {
      success: false,
      message: RATE_LIMIT_MESSAGE,
      requireCaptcha: true,
    });
  }

  const ipEmailLimit = checkRateLimit(ipEmailKey, LIMIT_IP_EMAIL, WINDOW_MS);
  if (!ipEmailLimit.ok) {
    await logAuthSecurityEvent({
      event: "rate_limit",
      reason: "RATE_LIMIT_IP_EMAIL",
      emailHash,
      ip,
      userAgent,
    });
    return jsonBody(429, {
      success: false,
      message: RATE_LIMIT_MESSAGE,
      requireCaptcha: true,
    });
  }

  // Captcha required after ≥1 prior failure (skipped only if secret not configured yet)
  if (requireCaptchaNow()) {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.warn(
        "[auth/sign-in] RECAPTCHA_SECRET_KEY ausente — captcha não verificado"
      );
    } else {
      const captcha = await verifyRecaptchaToken(captchaToken, ip);
      if (!captcha.ok) {
        recordAuthFailure(throttleKey);
        if (captcha.reason === "CAPTCHA_UNAVAILABLE") {
          await logAuthSecurityEvent({
            event: "captcha_failed",
            reason: "CAPTCHA_UNAVAILABLE",
            emailHash,
            ip,
            userAgent,
          });
          return jsonBody(500, {
            success: false,
            message: TEMP_ERROR_MESSAGE,
            requireCaptcha: true,
          });
        }
        await logAuthSecurityEvent({
          event: "captcha_failed",
          reason: "CAPTCHA_INVALID",
          emailHash,
          ip,
          userAgent,
        });
        return jsonBody(401, {
          success: false,
          message: OPAQUE_AUTH_MESSAGE,
          requireCaptcha: true,
        });
      }
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return jsonBody(500, {
      success: false,
      message: TEMP_ERROR_MESSAGE,
      requireCaptcha: requireCaptchaNow(),
    });
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies: CookieToSet[]) {
        cookiesToSet.push(...cookies);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    recordAuthFailure(throttleKey);
    const exists = await authUserExistsByEmail(email);
    const reason = exists === false ? "UNKNOWN_EMAIL" : "INVALID_PASSWORD";
    await logAuthSecurityEvent({
      event: "login_failed",
      reason,
      emailHash,
      ip,
      userAgent,
    });
    return jsonBody(401, {
      success: false,
      message: OPAQUE_AUTH_MESSAGE,
      requireCaptcha: true,
    });
  }

  clearAuthFailures(throttleKey);

  const redirectPath = await resolvePostAuthRedirect(
    supabase,
    data.user.id,
    sanitizeRedirectPath(redirectTo)
  );

  await logAuthSecurityEvent({
    event: "login_success",
    reason: "LOGIN_SUCCESS",
    emailHash,
    ip,
    userAgent,
  });

  const response = NextResponse.json({
    success: true,
    redirect: redirectPath,
    requireCaptcha: false,
  });

  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);
  }

  return response;
}
