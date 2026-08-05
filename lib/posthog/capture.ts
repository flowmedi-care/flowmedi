/**
 * Helper tipado para capturar eventos no client.
 * Use só propriedades agregadas / IDs — nunca nome, CPF, telefone, transcript, etc.
 *
 * @example
 * captureEvent("appointment_created", { source: "agenda" });
 */
export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  void import("posthog-js").then(({ default: posthog }) => {
    posthog.capture(event, properties);
  });
}
