import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { enforceMfaMiddleware } from "@/lib/compliance/mfa-middleware";
import {
  CANONICAL_APEX_HOST,
  extractClinicSubdomain,
  getCanonicalApexHost,
  isApexHost,
  isLegacyComBrHost,
  mapLegacyHostToCanonical,
} from "@/lib/public-site/host";
import { RESERVED_CLINIC_SLUGS } from "@/lib/public-site/types";
import { blockDevRoutesInProduction } from "@/lib/api-audit/guard";

const LEGACY_REDIRECT_ORIGIN = `https://${CANONICAL_APEX_HOST}`;

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
  const normalized = host.split(":")[0].toLowerCase();

  // Evita loop se destino coincidir com origem (ex.: env ainda em .com.br)
  if (normalized === canonicalHost || normalized === `www.${canonicalHost}`) {
    return null;
  }

  const target = new URL(`${pathname}${search}`, LEGACY_REDIRECT_ORIGIN);
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

function redirectRedundantSubdomainPath(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host") ?? "";
  const subdomain = extractClinicSubdomain(host);
  if (!subdomain) return null;

  const { pathname, search } = request.nextUrl;
  const prefix = `/c/${subdomain}`;
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length) || "/";
  const target = request.nextUrl.clone();
  target.pathname = rest;

  return NextResponse.redirect(target, 301);
}

function redirectPathToSubdomain(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host") ?? "";
  const normalized = host.split(":")[0].toLowerCase();

  if (!isApexHost(host)) return null;
  if (normalized === "localhost" || normalized === "127.0.0.1") return null;

  const { pathname, search } = request.nextUrl;
  const match = pathname.match(/^\/c\/([^/]+)(\/.*)?$/);
  if (!match) return null;

  const slug = match[1];
  if (RESERVED_CLINIC_SLUGS.has(slug)) return null;

  const rest = match[2] ?? "";
  const apex = getCanonicalApexHost();
  const target = new URL(`https://${slug}.${apex}${rest || "/"}${search}`);

  return NextResponse.redirect(target, 301);
}

export async function middleware(request: NextRequest) {
  if (blockDevRoutesInProduction(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const legacyRedirect = redirectLegacyDomainToCanonical(request);
  if (legacyRedirect) {
    return legacyRedirect;
  }

  const redundantSubdomainPath = redirectRedundantSubdomainPath(request);
  if (redundantSubdomainPath) {
    return redundantSubdomainPath;
  }

  const subdomainRewrite = rewriteSubdomainToPublicSite(request);
  if (subdomainRewrite) {
    return subdomainRewrite;
  }

  const pathRedirect = redirectPathToSubdomain(request);
  if (pathRedirect) {
    return pathRedirect;
  }

  return await updateSession(request, enforceMfaMiddleware);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
