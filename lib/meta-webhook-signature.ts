import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

export function requireMetaWebhookVerifyToken(): string {
  const token = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN é obrigatório para verificação do webhook Meta"
    );
  }
  return token;
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX) || !appSecret) return false;
  const received = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}
