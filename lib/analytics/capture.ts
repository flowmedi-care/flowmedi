import { posthog, isPostHogEnabled } from "@/lib/posthog/client";

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Captura tipada no client. Só IDs / agregados — nunca PHI.
 */
export function capture(event: string, properties?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  if (!isPostHogEnabled()) return;
  posthog.capture(event, properties);
}

/** Flush pendente (obrigatório antes de sair para wa.me). */
export async function flushAnalytics(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isPostHogEnabled()) return;
  try {
    const ph = posthog as typeof posthog & {
      flush?: () => Promise<void> | void;
    };
    if (typeof ph.flush === "function") {
      await ph.flush();
      return;
    }
    // Fallback: pequena espera para a fila HTTP sair
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    // ignore
  }
}
