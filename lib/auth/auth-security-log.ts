export type AuthSecurityReason =
  | "INVALID_PASSWORD"
  | "UNKNOWN_EMAIL"
  | "CAPTCHA_INVALID"
  | "CAPTCHA_UNAVAILABLE"
  | "RATE_LIMIT_IP"
  | "RATE_LIMIT_EMAIL"
  | "RATE_LIMIT_IP_EMAIL"
  | "THROTTLE_EARLY"
  | "LOGIN_SUCCESS"
  | "FORGOT_PASSWORD_REQUESTED"
  | "FORGOT_PASSWORD_RATE_LIMIT";

export type AuthSecurityEvent =
  | "login_success"
  | "login_failed"
  | "captcha_failed"
  | "rate_limit"
  | "forgot_password";

/**
 * Best-effort insert into auth_security_events. Never throws to callers.
 */
export async function logAuthSecurityEvent(params: {
  event: AuthSecurityEvent;
  reason: AuthSecurityReason;
  emailHash: string | null;
  ip: string;
  userAgent: string | null;
}): Promise<void> {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("auth_security_events").insert({
      event: params.event,
      reason: params.reason,
      email_hash: params.emailHash,
      ip: params.ip,
      user_agent: params.userAgent,
    });
    if (error) {
      console.error("[auth_security_events]", error.message);
    }
  } catch (err) {
    console.error("[auth_security_events]", err);
  }
}
