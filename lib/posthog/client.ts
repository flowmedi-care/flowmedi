import posthog from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

export function isPostHogEnabled(): boolean {
  return Boolean(POSTHOG_KEY);
}

/**
 * Init idempotente do PostHog no browser.
 * Privacidade (SaaS clínico / LGPD):
 * - sem session replay (risco de PHI na UI)
 * - sem autocapture (nomes de pacientes aparecem no DOM)
 * - pageviews manuais via provider
 */
export function initPostHog(): typeof posthog | null {
  if (typeof window === "undefined") return null;
  if (!POSTHOG_KEY) return null;
  if (initialized) return posthog;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });

  initialized = true;
  return posthog;
}

export { posthog };
