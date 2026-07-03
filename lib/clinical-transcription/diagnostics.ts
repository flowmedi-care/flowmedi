import {
  isClinicalStreamingEnabled,
  isClinicalStreamingFallbackToBatch,
} from "@/lib/clinical-transcription/feature-flags";

const PROBE_TIMEOUT_MS = 12_000;

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function getStreamApiBaseUrl(): string {
  const explicit = process.env.TRANSCRIBE_STREAM_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const base = process.env.TRANSCRIBE_API_URL ?? "https://transcribe.viaprove.com.br";
  return base.replace(/\/$/, "");
}

async function probeUrl(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status?: number; body?: string; error?: string; latencyMs: number }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = (await res.text()).slice(0, 500);
    return {
      ok: res.ok,
      status: res.status,
      body,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro de rede",
      latencyMs: Date.now() - started,
    };
  }
}

export async function gatherClinicalTranscriptionDiagnostics() {
  const streamApiUrl = getStreamApiBaseUrl();
  const healthUrl = `${streamApiUrl}/v1/stream/health`;
  const hasApiKey = Boolean(process.env.TRANSCRIBE_API_KEY?.trim());

  const checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
  }> = [];

  const streamingEnabled = isClinicalStreamingEnabled();
  checks.push({
    id: "feature_flag",
    label: "Streaming habilitado no Flowmedi",
    ok: streamingEnabled,
    detail: streamingEnabled
      ? "CLINICAL_STREAMING_TRANSCRIPTION_ENABLED=true"
      : "Defina CLINICAL_STREAMING_TRANSCRIPTION_ENABLED=true na Vercel",
  });

  checks.push({
    id: "api_key",
    label: "Chave da API de transcrição",
    ok: hasApiKey,
    detail: hasApiKey ? "TRANSCRIBE_API_KEY configurada" : "TRANSCRIBE_API_KEY ausente no servidor",
  });

  checks.push({
    id: "stream_url",
    label: "URL da API de streaming",
    ok: Boolean(streamApiUrl),
    detail: maskUrl(streamApiUrl),
  });

  const health = await probeUrl(healthUrl);
  checks.push({
    id: "stream_health",
    label: "VPS /v1/stream/health",
    ok: health.ok,
    detail: health.ok
      ? `HTTP ${health.status} em ${health.latencyMs}ms — ${health.body ?? ""}`
      : health.error
        ? `${health.error} (${health.latencyMs}ms)`
        : `HTTP ${health.status ?? "?"} em ${health.latencyMs}ms — ${health.body ?? ""}`,
  });

  let sessionProbe: { ok: boolean; detail: string } | null = null;
  if (hasApiKey && streamingEnabled) {
    const sessionUrl = `${streamApiUrl}/v1/stream/sessions`;
    const session = await probeUrl(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TRANSCRIBE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: "diagnostics",
        source: "recording",
        language: "pt",
      }),
    });

    sessionProbe = {
      ok: session.ok,
      detail: session.ok
        ? `HTTP ${session.status} em ${session.latencyMs}ms — sessão criada`
        : session.error
          ? `${session.error} (${session.latencyMs}ms)`
          : `HTTP ${session.status ?? "?"} em ${session.latencyMs}ms — ${session.body ?? ""}`,
    };

    checks.push({
      id: "stream_session",
      label: "VPS POST /v1/stream/sessions",
      ok: session.ok,
      detail: sessionProbe.detail,
    });
  }

  const allOk = checks.every((check) => check.ok);

  return {
    ok: allOk,
    streamingEnabled,
    fallbackToBatch: isClinicalStreamingFallbackToBatch(),
    streamApiUrl: maskUrl(streamApiUrl),
    healthUrl: maskUrl(healthUrl),
    checks,
    hints: allOk
      ? []
      : [
          !streamingEnabled
            ? "Ative CLINICAL_STREAMING_TRANSCRIPTION_ENABLED=true nas variáveis da Vercel."
            : null,
          !hasApiKey ? "Configure TRANSCRIBE_API_KEY (mesma chave da VPS)." : null,
          !health.ok
            ? "Na VPS: systemctl status transcribe-stream, curl http://127.0.0.1:8001/v1/stream/health e confira nginx location /v1/stream/ → porta 8001."
            : null,
          health.ok && sessionProbe && !sessionProbe.ok
            ? "Health OK mas sessão falhou — verifique API_KEY e logs do transcribe-stream."
            : null,
        ].filter(Boolean),
  };
}
