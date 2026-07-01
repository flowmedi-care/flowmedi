import { createHmac, timingSafeEqual } from "node:crypto";
import { toStoragePath } from "./storage-ref";

const PROXY_BUCKETS = new Set(["receipts", "quotes"]);

export type FileAccessPayload = {
  bucket: string;
  path: string;
  resourceType?: string;
  resourceId?: string;
};

function getSecret(): string {
  const secret = process.env.FILE_ACCESS_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error("FILE_ACCESS_TOKEN_SECRET é obrigatório para links de arquivos");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body, "utf8").digest("base64url");
}

export function createFileAccessToken(payload: FileAccessPayload): string {
  if (!PROXY_BUCKETS.has(payload.bucket)) {
    throw new Error(`Bucket não permitido no proxy: ${payload.bucket}`);
  }
  if (!payload.path?.trim()) {
    throw new Error("Path do arquivo é obrigatório");
  }

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyFileAccessToken(token: string): FileAccessPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);
  const expectedSig = sign(body);

  if (receivedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as FileAccessPayload;
    if (!PROXY_BUCKETS.has(payload.bucket) || !payload.path?.trim()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createFileAccessUrl(
  bucket: string,
  path: string,
  opts?: { resourceType?: string; resourceId?: string }
): string {
  const token = createFileAccessToken({ bucket, path, ...opts });
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/api/files/${encodeURIComponent(token)}`;
}

/** Resolve URL de paciente a partir de metadata (path novo ou URL legada). */
export function resolvePatientFileUrlFromMetadata(
  bucket: "receipts" | "quotes",
  metadata: Record<string, unknown>
): string {
  const explicitPath = metadata.pdf_storage_path
    ? String(metadata.pdf_storage_path)
    : null;
  const legacy = metadata.pdf_url ? String(metadata.pdf_url) : null;

  const path =
    explicitPath ??
    (legacy ? toStoragePath(bucket, legacy) : null);

  if (!path) return "";
  return createFileAccessUrl(bucket, path);
}
