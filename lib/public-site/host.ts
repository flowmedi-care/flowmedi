import { RESERVED_CLINIC_SLUGS } from "./types";

const DEFAULT_APP_ORIGIN = "https://flowmed.app";

const DEFAULT_APEX_HOSTS = new Set([
  "flowmed.app",
  "www.flowmed.app",
  "flowmedi.com.br",
  "www.flowmedi.com.br",
  "localhost",
  "127.0.0.1",
]);

/** Sufixos de subdomínio de clínica (transição: .app e .com.br). */
const CLINIC_SUBDOMAIN_SUFFIXES = [".flowmed.app", ".flowmedi.com.br"] as const;

function normalizeHost(host: string): string {
  return host.split(":")[0].toLowerCase();
}

function extractSubdomainFromSuffix(
  normalized: string,
  suffix: string
): string | null {
  if (!normalized.endsWith(suffix)) return null;
  const sub = normalized.slice(0, -suffix.length);
  if (sub && !sub.includes(".") && !RESERVED_CLINIC_SLUGS.has(sub)) {
    return sub;
  }
  return null;
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

  for (const suffix of CLINIC_SUBDOMAIN_SUFFIXES) {
    const sub = extractSubdomainFromSuffix(normalized, suffix);
    if (sub) return sub;
  }

  return null;
}

/** Host apex canônico derivado de NEXT_PUBLIC_APP_URL (ex.: flowmed.app). */
export function getCanonicalApexHost(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_ORIGIN;
  try {
    const hostname = new URL(base).hostname;
    if (hostname === "www.flowmed.app" || hostname === "www.flowmedi.com.br") {
      return hostname.replace(/^www\./, "");
    }
    return hostname;
  } catch {
    return "flowmed.app";
  }
}

export function getSubdomainSiteUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_ORIGIN;
  try {
    const url = new URL(base);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return `http://${slug}.localhost:${url.port || "3000"}`;
    }
    const apex = getCanonicalApexHost();
    return `https://${slug}.${apex}`;
  } catch {
    return `https://${slug}.flowmed.app`;
  }
}

/** true se o host é apex legado flowmedi.com.br (para redirect no middleware). */
export function isLegacyComBrHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized === "flowmedi.com.br" ||
    normalized === "www.flowmedi.com.br" ||
    normalized.endsWith(".flowmedi.com.br")
  );
}

/** Host de destino após redirect legado → canônico. */
export function mapLegacyHostToCanonical(host: string): string {
  const normalized = normalizeHost(host);
  const apex = getCanonicalApexHost();

  if (normalized === "flowmedi.com.br" || normalized === "www.flowmedi.com.br") {
    return apex;
  }

  if (normalized.endsWith(".flowmedi.com.br")) {
    const sub = normalized.replace(/\.flowmedi\.com\.br$/, "");
    if (sub && !sub.includes(".")) {
      return `${sub}.${apex}`;
    }
  }

  return apex;
}
