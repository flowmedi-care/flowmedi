import type { NextRequest } from "next/server";

const GOOGLE_OAUTH_CALLBACK_PATH = "/api/integrations/google/callback";

/** Origem canônica do app (sem barra final). */
export function getAppOrigin(requestOrigin?: string | null): string {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (requestOrigin?.trim()) {
    return requestOrigin.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

/** Origem usada no redirect_uri do OAuth Google (respeita NEXT_PUBLIC_APP_URL). */
export function getOAuthRedirectOrigin(request: NextRequest): string {
  return getAppOrigin(request.nextUrl.origin);
}

export function getGoogleOAuthRedirectUri(request: NextRequest): string {
  return `${getOAuthRedirectOrigin(request)}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}
