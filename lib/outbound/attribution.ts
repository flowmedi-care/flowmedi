import { posthog, isPostHogEnabled } from "@/lib/posthog/client";
import { getDeviceType } from "@/lib/analytics/device";
import {
  compactAttribution,
  parseOutboundSearchParams,
  type OutboundAttribution,
} from "@/lib/outbound/utm";

const MARKETING_RECORDING_PREFIXES = [
  "/clinicas",
  "/precos",
  "/recursos",
  "/seguranca",
  "/contato",
  "/sugestoes",
];

/** Home pública também. */
function isMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_RECORDING_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isClinicalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/c/")
  );
}

/**
 * Recording só em páginas públicas de marketing.
 * Nunca no painel clínico / microsites de pacientes.
 */
export function syncSessionRecording(pathname: string): void {
  if (!isPostHogEnabled()) return;
  try {
    if (isClinicalPath(pathname)) {
      posthog.stopSessionRecording?.();
      return;
    }
    if (isMarketingPath(pathname)) {
      posthog.startSessionRecording?.();
    } else {
      posthog.stopSessionRecording?.();
    }
  } catch {
    // ignore
  }
}

/**
 * Lê query, register super props, identify por lead quando existir.
 */
export function applyOutboundAttribution(
  searchParams: URLSearchParams
): OutboundAttribution {
  const attrs = parseOutboundSearchParams(searchParams);
  const compact = compactAttribution(attrs);
  const device_type = getDeviceType();

  if (!isPostHogEnabled()) return attrs;

  const superProps: Record<string, string> = {
    ...compact,
    device_type,
  };

  if (Object.keys(superProps).length > 0) {
    posthog.register(superProps);
  }

  if (attrs.lead) {
    posthog.identify(`outbound:${attrs.lead}`, {
      lead: attrs.lead,
      ...compact,
      device_type,
    });
  } else {
    posthog.setPersonProperties?.({ device_type, ...compact });
  }

  return attrs;
}

export function setOutboundPersonProperties(
  props: Record<string, string | number | boolean>
): void {
  if (!isPostHogEnabled()) return;
  posthog.setPersonProperties?.(props);
}
