import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  extractClinicSubdomain,
  isLegacyComBrHost,
  mapLegacyHostToCanonical,
} from "@/lib/public-site/host";
import { blockDevRoutesInProduction } from "@/lib/api-audit/guard";

const CANONICAL_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://flowmed.app";

/** Rotas que não devem ser redirecionadas do domínio legado (webhooks, OAuth, assets). */
function shouldSkipLegacyRedirect(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth/callback")
  );
}

function redirectLegacyDomainToCanonical(
  request: NextRequest
): NextResponse | null {
  const host = request.headers.get("host") ?? "";
  if (!isLegacyComBrHost(host)) return null;

  const { pathname, search } = request.nextUrl;
  if (shouldSkipLegacyRedirect(pathname)) return null;

  const canonicalHost = mapLegacyHostToCanonical(host);
  const target = new URL(`${pathname}${search}`, CANONICAL_ORIGIN);
  target.host = canonicalHost;

  return NextResponse.redirect(target, 301);
}

function rewriteSubdomainToPublicSite(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host") ?? "";
  const subdomain = extractClinicSubdomain(host);

  if (!subdomain) return null;

  const { pathname } = request.nextUrl;

  // Evita reescrever assets, API e rotas internas
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dev") ||
    pathname.startsWith("/c/")
  ) {
    return null;
  }

  const rewritePath = pathname === "/" ? `/c/${subdomain}` : `/c/${subdomain}${pathname}`;
  const url = request.nextUrl.clone();
  url.pathname = rewritePath;

  return NextResponse.rewrite(url);
}

export async function middleware(request: NextRequest) {
  if (blockDevRoutesInProduction(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const legacyRedirect = redirectLegacyDomainToCanonical(request);
  if (legacyRedirect) {
    return legacyRedirect;
  }

  const subdomainRewrite = rewriteSubdomainToPublicSite(request);
  if (subdomainRewrite) {
    return subdomainRewrite;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
