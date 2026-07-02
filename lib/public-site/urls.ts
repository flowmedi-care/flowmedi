import { headers } from "next/headers";
import { extractClinicSubdomain, getSubdomainSiteUrl } from "./host";

export function publicSiteHomePath(
  slug: string,
  onClinicSubdomain: boolean,
  hash?: string
): string {
  const base = onClinicSubdomain ? "/" : `/c/${slug}`;
  if (!hash) return base;
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  return `${base}${normalized}`;
}

export function publicSiteBookingPath(
  slug: string,
  onClinicSubdomain: boolean,
  params?: Record<string, string>
): string {
  const base = onClinicSubdomain ? "/agendar" : `/c/${slug}/agendar`;
  if (!params || Object.keys(params).length === 0) return base;
  const qs = new URLSearchParams(params).toString();
  return `${base}?${qs}`;
}

/** URL canônica preferida do site público (subdomínio). */
export function getPreferredPublicSiteUrl(slug: string): string {
  return getSubdomainSiteUrl(slug);
}

export async function isOnClinicSubdomain(): Promise<boolean> {
  const headersList = await headers();
  return !!extractClinicSubdomain(headersList.get("host") ?? "");
}
