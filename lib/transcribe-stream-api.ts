import type { StreamSessionArtifact, StreamSessionResponse } from "@/lib/clinical-transcription/types";

const RETRYABLE_STATUSES = new Set([500, 502, 503]);
const RETRY_DELAYS_MS = [2000, 5000];

function getStreamApiUrl(): string {
  const explicit = process.env.TRANSCRIBE_STREAM_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const base = process.env.TRANSCRIBE_API_URL ?? "https://transcribe.viaprove.com.br";
  return base.replace(/\/$/, "");
}

function getStreamWsUrl(): string {
  const explicit = process.env.TRANSCRIBE_STREAM_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const apiUrl = getStreamApiUrl();
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace(/^https:/, "wss:") + "/v1/stream/ws";
  }
  if (apiUrl.startsWith("http://")) {
    return apiUrl.replace(/^http:/, "ws:") + "/v1/stream/ws";
  }
  return `wss://${apiUrl}/v1/stream/ws`;
}

function getApiKey(): string {
  const key = process.env.TRANSCRIBE_API_KEY;
  if (!key) {
    throw new Error("TRANSCRIBE_API_KEY não configurada no servidor.");
  }
  return key;
}

async function parseErrorResponse(res: Response): Promise<string> {
  const rawText = await res.text();
  try {
    const body = JSON.parse(rawText) as {
      detail?: string | Array<{ msg?: string; message?: string }>;
      message?: string;
      error?: string;
    };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const parts = body.detail
        .map((item) => item.msg ?? item.message)
        .filter(Boolean);
      if (parts.length > 0) return parts.join("; ");
    }
    if (body.message) return body.message;
    if (body.error) return body.error;
    if (rawText.trim()) return rawText.slice(0, 500);
  } catch {
    if (rawText.trim()) return rawText.slice(0, 500);
  }
  return `Erro na API de streaming (${res.status})`;
}

async function fetchStreamWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || !RETRYABLE_STATUSES.has(res.status) || attempt === maxRetries) {
      return res;
    }
    const detail = await parseErrorResponse(res);
    lastError = new Error(detail);
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    await new Promise((r) => setTimeout(r, delay));
  }

  throw lastError ?? new Error("Erro na API de streaming.");
}

export async function createStreamSession(opts: {
  userId: string;
  appointmentId: string;
  language?: string;
}): Promise<StreamSessionResponse> {
  const url = `${getStreamApiUrl()}/v1/stream/sessions`;
  console.info("[TranscribeStream] create session", {
    url,
    userId: opts.userId,
    appointmentId: opts.appointmentId,
  });

  const res = await fetchStreamWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: opts.userId,
      source: "recording",
      appointment_id: opts.appointmentId,
      language: opts.language ?? "pt",
      metadata: { appointment_id: opts.appointmentId },
    }),
  });

  if (!res.ok) {
    const detail = await parseErrorResponse(res);
    console.error("[TranscribeStream] create session failed", { status: res.status, detail });
    throw new Error(detail);
  }

  const data = (await res.json()) as Partial<StreamSessionResponse>;
  if (!data.session_id || !data.ws_token) {
    throw new Error("Resposta inválida da API de streaming (sem session_id ou ws_token).");
  }

  return {
    session_id: data.session_id,
    ws_url: data.ws_url ?? getStreamWsUrl(),
    ws_token: data.ws_token,
    expires_at: data.expires_at ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

export async function getStreamSessionArtifact(sessionId: string): Promise<StreamSessionArtifact> {
  const url = `${getStreamApiUrl()}/v1/stream/sessions/${encodeURIComponent(sessionId)}`;
  const res = await fetchStreamWithRetry(url, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    const detail = await parseErrorResponse(res);
    throw new Error(detail);
  }

  return (await res.json()) as StreamSessionArtifact;
}

export function resolvePublicStreamWsUrl(wsUrl: string, wsToken: string): string {
  const separator = wsUrl.includes("?") ? "&" : "?";
  return `${wsUrl}${separator}token=${encodeURIComponent(wsToken)}`;
}
