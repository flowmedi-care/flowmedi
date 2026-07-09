const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface TranscribeAudioOptions {
  filename: string;
  mimeType: string;
  language?: string;
  timeoutMs?: number;
}

export interface TranscribeAudioResult {
  text: string;
  processingMs: number;
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  return key;
}

function getModel(): string {
  return process.env.OPENAI_WHISPER_MODEL?.trim() || "whisper-1";
}

function getDefaultTimeoutMs(): number {
  const raw = process.env.WPP_OPENAI_TRANSCRIBE_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 60_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

function mapHttpError(status: number, body: string): string {
  if (status === 401) {
    return "OpenAI: chave de API inválida ou ausente.";
  }
  if (status === 413) {
    return "OpenAI: arquivo de áudio muito grande (limite 25 MB).";
  }
  if (status === 429) {
    return "OpenAI: limite de requisições atingido. Tente novamente em instantes.";
  }
  const snippet = body.slice(0, 300).trim();
  return snippet ? `OpenAI (${status}): ${snippet}` : `OpenAI: erro HTTP ${status}.`;
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  options: TranscribeAudioOptions
): Promise<TranscribeAudioResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? getDefaultTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    const blob = new Blob([buffer], { type: options.mimeType });
    form.append("file", blob, options.filename);
    form.append("model", getModel());
    form.append("language", options.language ?? "pt");
    form.append("response_format", "json");

    const res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(mapHttpError(res.status, body));
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) {
      throw new Error("OpenAI retornou transcrição vazia.");
    }

    return {
      text,
      processingMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenAI: timeout após ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
