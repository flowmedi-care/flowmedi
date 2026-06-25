import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { extractClinicSubdomain } from "@/lib/public-site/host";

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
