import { RESERVED_CLINIC_SLUGS } from "./types";

const DEFAULT_APEX_HOSTS = new Set([
  "flowmedi.com.br",
  "www.flowmedi.com.br",
  "localhost",
  "127.0.0.1",
]);

function normalizeHost(host: string): string {
  return host.split(":")[0].toLowerCase();
}

export function extractClinicSubdomain(host: string): string | null {
  const normalized = normalizeHost(host);

  if (DEFAULT_APEX_HOSTS.has(normalized)) {
    return null;
  }

  if (normalized.endsWith(".localhost")) {
    const sub = normalized.replace(/\.localhost$/, "");
    if (sub && !RESERVED_CLINIC_SLUGS.has(sub)) return sub;
    return null;
  }

  if (normalized.endsWith(".flowmedi.com.br")) {
    const sub = normalized.replace(/\.flowmedi.com.br$/, "");
    if (sub && !sub.includes(".") && !RESERVED_CLINIC_SLUGS.has(sub)) {
      return sub;
    }
  }

  return null;
}

export function getSubdomainSiteUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://flowmedi.com.br";
  try {
    const url = new URL(base);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return `http://${slug}.localhost:${url.port || "3000"}`;
    }
    return `https://${slug}.flowmedi.com.br`;
  } catch {
    return `https://${slug}.flowmedi.com.br`;
  }
}
