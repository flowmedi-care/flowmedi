/**
 * Armazena o último payload do webhook em memória (para debug).
 */

let lastPayload: { body: unknown; receivedAt: string } | null = null;

export function setLastWebhookPayload(body: unknown) {
  lastPayload = { body, receivedAt: new Date().toISOString() };
}

export function getLastWebhookPayload() {
  return lastPayload;
}
