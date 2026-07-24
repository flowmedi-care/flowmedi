import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail, hashEmail } from "@/lib/auth/email-hash";
import { checkRateLimit, getClientIp } from "@/lib/auth/auth-rate-limit";
import { logAuthSecurityEvent } from "@/lib/auth/auth-security-log";

const GENERIC_OK =
  "Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Verifique a caixa de entrada e o spam.";
const RATE_LIMIT_MESSAGE = "Muitas solicitações. Tente novamente mais tarde.";
const VALIDATION_MESSAGE = "Informe um e-mail válido.";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LIMIT = 3;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: VALIDATION_MESSAGE },
      { status: 400 }
    );
  }

  const emailRaw =
    typeof payload === "object" &&
    payload &&
    "email" in payload &&
    typeof (payload as { email: unknown }).email === "string"
      ? (payload as { email: string }).email
      : "";

  const email = normalizeEmail(emailRaw);
  const emailHash = email ? hashEmail(email) : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { success: false, message: VALIDATION_MESSAGE },
      { status: 400 }
    );
  }

  const ipLimit = checkRateLimit(`auth-forgot-ip:${ip}`, LIMIT, WINDOW_MS);
  const emailLimit = checkRateLimit(`auth-forgot-email:${email}`, LIMIT, WINDOW_MS);

  if (!ipLimit.ok || !emailLimit.ok) {
    await logAuthSecurityEvent({
      event: "rate_limit",
      reason: "FORGOT_PASSWORD_RATE_LIMIT",
      emailHash,
      ip,
      userAgent,
    });
    return NextResponse.json(
      { success: false, message: RATE_LIMIT_MESSAGE },
      { status: 429 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin;

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
    });
  } catch (err) {
    console.error("[forgot-password]", err);
  }

  await logAuthSecurityEvent({
    event: "forgot_password",
    reason: "FORGOT_PASSWORD_REQUESTED",
    emailHash,
    ip,
    userAgent,
  });

  // Always opaque success — do not reveal whether the email exists
  return NextResponse.json({ success: true, message: GENERIC_OK });
}
