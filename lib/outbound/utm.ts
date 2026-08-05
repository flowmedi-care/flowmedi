export const OUTBOUND_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "message",
  "lead",
  "owner",
  "niche",
  "city",
  "state",
  "copy",
] as const;

export type OutboundQueryKey = (typeof OUTBOUND_QUERY_KEYS)[number];

export type OutboundAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** Versão da mensagem WhatsApp (v1, v2…) — prop PostHog: outbound_message */
  outbound_message?: string;
  lead?: string;
  owner?: string;
  niche?: string;
  city?: string;
  state?: string;
  copy_variant?: string;
};

export function parseOutboundSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): OutboundAttribution {
  const get = (k: string) => {
    const v = searchParams.get(k)?.trim();
    return v || undefined;
  };

  const copy = get("copy");
  const message = get("message");

  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_content: get("utm_content"),
    utm_term: get("utm_term"),
    outbound_message: message,
    lead: get("lead"),
    owner: get("owner"),
    niche: get("niche"),
    city: get("city"),
    state: get("state"),
    copy_variant: copy ? copy.toUpperCase() : undefined,
  };
}

/** Remove undefined para register/setPersonProperties. */
export function compactAttribution(
  attrs: OutboundAttribution
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  return out;
}
