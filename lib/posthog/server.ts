import { PostHog } from "posthog-node";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Client Node para server actions / route handlers.
 * Sempre chamar `await client.shutdown()` após capturar em handlers curtos.
 */
export function createPostHogServerClient(): PostHog | null {
  if (!key) return null;
  return new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });
}

/** Propriedades que nunca devem ir ao PostHog (PHI / PII sensível). */
const BLOCKED_PROPERTY_KEYS = new Set([
  "name",
  "full_name",
  "patient_name",
  "patientName",
  "cpf",
  "email",
  "phone",
  "telefone",
  "whatsapp",
  "message",
  "body",
  "transcript",
  "notes",
  "content",
  "address",
  "endereco",
]);

export function sanitizePostHogProperties(
  properties?: Record<string, unknown>
): Record<string, unknown> {
  if (!properties) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (BLOCKED_PROPERTY_KEYS.has(k)) continue;
    if (typeof v === "string" && v.length > 200) continue;
    out[k] = v;
  }
  return out;
}

export async function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  groups?: Record<string, string>;
}): Promise<void> {
  const client = createPostHogServerClient();
  if (!client) return;
  try {
    client.capture({
      distinctId: params.distinctId,
      event: params.event,
      properties: sanitizePostHogProperties(params.properties),
      groups: params.groups,
    });
    await client.shutdown();
  } catch (err) {
    console.error("[posthog]", err);
  }
}
